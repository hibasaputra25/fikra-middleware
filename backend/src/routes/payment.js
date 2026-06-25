const express = require('express');
const router  = express.Router();
const { authMiddleware } = require('../middleware/auth');
const {
    createOrder,
    handleWebhook,
    getSubscriptionStatus,
    getPlanPrices,
} = require('../services/paymentService');

// =====================================================================
// GET /api/payment/plans
// Public — daftar harga plan
// =====================================================================
router.get('/plans', (req, res) => {
    res.json(getPlanPrices());
});

// =====================================================================
// GET /api/payment/subscription
// Ambil status subscription user saat ini
// =====================================================================
router.get('/subscription', authMiddleware, async (req, res, next) => {
    try {
        const status = await getSubscriptionStatus(req.user.id);
        res.json(status);
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// POST /api/payment/create-order
// Buat order baru, return snap_token untuk frontend
// Body: { plan, duration_months }
// =====================================================================
router.post('/create-order', authMiddleware, async (req, res, next) => {
    try {
        const { plan = 'premium', duration_months = 1 } = req.body;
        const result = await createOrder(req.user, { plan, duration_months });
        res.status(201).json(result);
    } catch (err) {
        if (err.message.includes('tidak valid')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
});

// =====================================================================
// GET /api/payment/status/:orderId
// Cek status order tertentu
// =====================================================================
router.get('/status/:orderId', authMiddleware, async (req, res, next) => {
    try {
        const { pool } = require('../config/db');
        const [[order]] = await pool.execute(
            'SELECT * FROM payment_orders WHERE order_id = ? AND user_id = ? LIMIT 1',
            [req.params.orderId, req.user.id]
        );
        if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
        res.json(order);
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// GET /api/payment/history
// Riwayat pembayaran user
// =====================================================================
router.get('/history', authMiddleware, async (req, res, next) => {
    try {
        const { pool } = require('../config/db');
        const [orders] = await pool.execute(
            `SELECT id, order_id, plan, duration_months, amount, status, paid_at, created_at
             FROM payment_orders
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 20`,
            [req.user.id]
        );
        res.json(orders);
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// POST /api/payment/webhook
// Midtrans notification — NO AUTH (Midtrans pakai signature key)
// =====================================================================
router.post('/webhook', async (req, res, next) => {
    try {
        const result = await handleWebhook(req.body);
        res.json(result);
    } catch (err) {
        // Tetap return 200 ke Midtrans agar tidak di-retry terus
        // tapi log error untuk investigasi
        console.error('❌ Webhook error:', err.message);
        if (err.message === 'Signature tidak valid') {
            return res.status(403).json({ error: 'Signature tidak valid' });
        }
        res.status(200).json({ error: err.message });
    }
});

module.exports = router;
