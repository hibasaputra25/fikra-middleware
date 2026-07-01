const midtransClient = require('midtrans-client');
const { pool }       = require('../config/db');
const { sendPaymentSuccessEmail } = require('./emailService');

// =====================================================================
// MIDTRANS SNAP CLIENT
// =====================================================================
let _snap = null;
function getSnap() {
    if (_snap) return _snap;
    _snap = new midtransClient.Snap({
        isProduction: process.env.MIDTRANS_ENV === 'production',
        serverKey:    process.env.MIDTRANS_SERVER_KEY,
        clientKey:    process.env.MIDTRANS_CLIENT_KEY,
    });
    return _snap;
}

// Harga per plan (rupiah)
const PLAN_PRICES = {
    premium_1:  99000,   // 1 bulan
    premium_3:  249000,  // 3 bulan
    premium_6:  449000,  // 6 bulan
    premium_12: 799000,  // 12 bulan
};

// =====================================================================
// CREATE ORDER
// Buat payment order + Midtrans Snap token
// =====================================================================
async function createOrder(user, { plan = 'premium', duration_months = 1 }) {
    const planKey   = `${plan}_${duration_months}`;
    const amount    = PLAN_PRICES[planKey];
    if (!amount) throw new Error('Paket tidak valid');

    // Buat order_id unik
    const orderId = `FIKRA-${user.id}-${Date.now()}`;

    // Simpan order ke DB
    const [result] = await pool.execute(
        `INSERT INTO payment_orders (user_id, order_id, plan, duration_months, amount, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [user.id, orderId, plan, duration_months, amount]
    );
    const dbOrderId = result.insertId;

    // Buat Snap token
    const snapParams = {
        transaction_details: {
            order_id:     orderId,
            gross_amount: amount,
        },
        customer_details: {
            first_name: user.nama,
            email:      user.email,
        },
        item_details: [{
            id:       planKey,
            price:    amount,
            quantity: 1,
            name:     `Fikra Academy Premium - ${duration_months} Bulan`,
        }],
        callbacks: {
            finish:  `${process.env.APP_URL || 'http://localhost:3000'}/siswa/subscription?status=finish`,
            error:   `${process.env.APP_URL || 'http://localhost:3000'}/siswa/subscription?status=error`,
            pending: `${process.env.APP_URL || 'http://localhost:3000'}/siswa/subscription?status=pending`,
        },
    };

    const snapResponse = await getSnap().createTransaction(snapParams);

    // Simpan snap_token
    await pool.execute(
        'UPDATE payment_orders SET snap_token = ? WHERE id = ?',
        [snapResponse.token, dbOrderId]
    );

    return {
        order_id:   orderId,
        snap_token: snapResponse.token,
        amount,
        plan,
        duration_months,
    };
}

// =====================================================================
// HANDLE WEBHOOK
// Midtrans akan POST ke /api/payment/webhook saat transaksi berubah status
// =====================================================================
async function handleWebhook(notification) {
    // Verifikasi signature dari Midtrans
    const crypto      = require('crypto');
    const serverKey   = process.env.MIDTRANS_SERVER_KEY;
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = notification;

    const expectedSig = crypto
        .createHash('sha512')
        .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
        .digest('hex');

    if (expectedSig !== signature_key) {
        throw new Error('Signature tidak valid');
    }

    // Ambil order dari DB
    const [[order]] = await pool.execute(
        'SELECT * FROM payment_orders WHERE order_id = ? LIMIT 1',
        [order_id]
    );
    if (!order) throw new Error('Order tidak ditemukan');

    // Idempotency: kalau sudah paid, skip
    if (order.status === 'paid') return { already_processed: true };

    // Tentukan status baru
    let newStatus = order.status;
    if (transaction_status === 'capture' && fraud_status === 'accept') newStatus = 'paid';
    else if (transaction_status === 'settlement')                        newStatus = 'paid';
    else if (['cancel', 'deny', 'expire'].includes(transaction_status)) newStatus = 'failed';
    else if (transaction_status === 'pending')                           newStatus = 'pending';

    // Atomic update: hanya update jika status masih bukan 'paid'
    // Ini mencegah race condition jika dua webhook datang bersamaan
    const [updateResult] = await pool.execute(
        `UPDATE payment_orders
         SET status = ?, gateway_response = ?, paid_at = IF(? = 'paid', NOW(), paid_at), updated_at = NOW()
         WHERE order_id = ? AND status != 'paid'`,
        [newStatus, JSON.stringify(notification), newStatus, order_id]
    );

    // Jika affectedRows = 0, berarti order sudah paid (race condition) — skip
    if (updateResult.affectedRows === 0) {
        return { already_processed: true };
    }

    // Jika paid: aktifkan / perpanjang subscription
    if (newStatus === 'paid') {
        await activateSubscription(order);
    }

    return { processed: true, status: newStatus };
}

// =====================================================================
// ACTIVATE SUBSCRIPTION
// =====================================================================
async function activateSubscription(order) {
    // Hitung tanggal kadaluarsa
    const [[existing]] = await pool.execute(
        `SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' AND plan = 'premium' LIMIT 1`,
        [order.user_id]
    );

    let baseDate = new Date();
    if (existing?.expires_at && new Date(existing.expires_at) > baseDate) {
        // Perpanjang dari tanggal yang sudah ada (stacking)
        baseDate = new Date(existing.expires_at);
    }

    const expiresAt = new Date(baseDate);
    expiresAt.setMonth(expiresAt.getMonth() + order.duration_months);
    const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

    if (existing) {
        await pool.execute(
            `UPDATE subscriptions SET plan = 'premium', status = 'active', expires_at = ?, updated_at = NOW()
             WHERE user_id = ?`,
            [expiresAtStr, order.user_id]
        );
    } else {
        await pool.execute(
            `INSERT INTO subscriptions (user_id, plan, status, expires_at)
             VALUES (?, 'premium', 'active', ?)`,
            [order.user_id, expiresAtStr]
        );
    }

    // Kirim email konfirmasi (non-blocking)
    try {
        const [[user]] = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [order.user_id]);
        if (user) {
            sendPaymentSuccessEmail(user, { ...order, expires_at: expiresAtStr }).catch(() => {});
        }
    } catch (_) {}
}

// =====================================================================
// GET SUBSCRIPTION STATUS
// =====================================================================
async function getSubscriptionStatus(userId) {
    const [[sub]] = await pool.execute(
        `SELECT * FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
        [userId]
    );

    // Auto-expire: kalau premium dan sudah lewat tanggal
    if (sub?.plan === 'premium' && sub?.expires_at && new Date(sub.expires_at) < new Date()) {
        await pool.execute(
            `UPDATE subscriptions SET status = 'expired', updated_at = NOW() WHERE id = ?`,
            [sub.id]
        );
        sub.status = 'expired';
        sub.plan   = 'free';
    }

    return sub || { plan: 'free', status: 'active', expires_at: null };
}

// =====================================================================
// GET PLAN PRICES (untuk frontend)
// =====================================================================
function getPlanPrices() {
    return [
        { plan: 'premium', duration_months: 1,  label: '1 Bulan',  amount: PLAN_PRICES.premium_1  },
        { plan: 'premium', duration_months: 3,  label: '3 Bulan',  amount: PLAN_PRICES.premium_3, badge: 'Hemat 16%' },
        { plan: 'premium', duration_months: 6,  label: '6 Bulan',  amount: PLAN_PRICES.premium_6, badge: 'Hemat 24%' },
        { plan: 'premium', duration_months: 12, label: '12 Bulan', amount: PLAN_PRICES.premium_12, badge: 'Hemat 33%' },
    ];
}

module.exports = {
    createOrder,
    handleWebhook,
    getSubscriptionStatus,
    getPlanPrices,
};
