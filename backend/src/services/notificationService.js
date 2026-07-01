const { pool } = require('../config/db');
const { sendNotificationEmail } = require('./emailService');

// =====================================================================
// HELPERS
// =====================================================================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Kirim email dalam batch kecil dengan delay antar batch
 * Mencegah SMTP rate limiting dari Google
 * @param {Array} users - array { id, nama, email }
 * @param {Object} notification - { type, title, body, url }
 * @param {number} batchSize - jumlah email per batch (default: 5)
 * @param {number} delayMs - delay antar batch dalam ms (default: 500)
 */
async function sendEmailBatched(users, notification, batchSize = 5, delayMs = 500) {
    for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        await Promise.all(
            batch.map(user =>
                sendNotificationEmail(user, notification).catch(err =>
                    console.warn(`⚠️  Gagal kirim email notif ke user ${user.id}:`, err.message)
                )
            )
        );
        // Delay sebelum batch berikutnya, kecuali batch terakhir
        if (i + batchSize < users.length) {
            await sleep(delayMs);
        }
    }
}

// =====================================================================
// SEND — buat notifikasi in-app + kirim email (non-blocking)
// =====================================================================

/**
 * Kirim notifikasi ke satu atau banyak user
 * url default ke '/siswa/notifikasi' jika tidak diisi
 */
async function send(opts) {
    const items = Array.isArray(opts) ? opts : [opts];
    if (items.length === 0) return;

    // Pastikan url selalu ada dan benar
    const normalized = items.map(n => ({
        ...n,
        url: n.url || '/siswa/notifikasi',
    }));

    const values = normalized.map(n => [
        n.user_id, n.type, n.title, n.body || null, n.url
    ]);

    // Insert semua notifikasi in-app sekaligus (atomik, cepat)
    await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, url) VALUES ?`,
        [values]
    );

    // Kirim email secara non-blocking — tidak menunggu semua email selesai
    // sebelum return, tapi tetap terkontrol dengan batching
    setImmediate(async () => {
        try {
            // Ambil data user sekaligus (1 query) daripada per-user
            const userIds = [...new Set(normalized.map(n => n.user_id).filter(Boolean))];
            if (userIds.length === 0) return;

            const ph = userIds.map(() => '?').join(',');
            const [users] = await pool.execute(
                `SELECT id, nama, email FROM users WHERE id IN (${ph}) AND is_active = 1`,
                userIds
            );
            const userMap = {};
            users.forEach(u => { userMap[u.id] = u; });

            // Siapkan pasangan user + notif
            const emailTasks = normalized
                .filter(n => n.user_id && userMap[n.user_id])
                .map(n => ({ user: userMap[n.user_id], notif: n }));

            // Kirim dalam batch — 5 per batch, jeda 500ms
            for (let i = 0; i < emailTasks.length; i += 5) {
                const batch = emailTasks.slice(i, i + 5);
                await Promise.all(
                    batch.map(({ user, notif }) =>
                        sendNotificationEmail(user, notif).catch(err =>
                            console.warn(`⚠️  Gagal kirim email ke ${user.email}:`, err.message)
                        )
                    )
                );
                if (i + 5 < emailTasks.length) await sleep(500);
            }

            console.log(`✅  Email notif terkirim: ${emailTasks.length} penerima`);
        } catch (err) {
            console.warn('⚠️  Error saat kirim email batch:', err.message);
        }
    });
}

/**
 * Broadcast notifikasi ke semua user dengan role tertentu
 */
async function broadcast({ role, type, title, body, url }) {
    const [users] = await pool.execute(
        `SELECT id FROM users WHERE role = ? AND is_active = 1`,
        [role]
    );
    if (users.length === 0) return;

    const items = users.map(u => ({ user_id: u.id, type, title, body, url }));
    await send(items);
}

/**
 * Broadcast ke siswa-siswa milik guru tertentu
 */
async function broadcastToGursSiswa({ guru_id, type, title, body, url }) {
    const [users] = await pool.execute(
        `SELECT gs.siswa_id AS id FROM guru_siswa gs
         JOIN users u ON u.id = gs.siswa_id
         WHERE gs.guru_id = ? AND u.is_active = 1`,
        [guru_id]
    );
    if (users.length === 0) return;
    const items = users.map(u => ({ user_id: u.id, type, title, body, url }));
    await send(items);
}

// =====================================================================
// GET — ambil notifikasi user
// =====================================================================

async function getForUser(userId, { limit = 20, offset = 0 } = {}) {
    const safeLimit  = parseInt(limit)  || 20;
    const safeOffset = parseInt(offset) || 0;
    const [rows] = await pool.query(
        `SELECT id, type, title, body, url, is_read, read_at, created_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        [userId]
    );
    return rows;
}

async function getUnreadCount(userId) {
    const [[row]] = await pool.execute(
        `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0`,
        [userId]
    );
    return row.count;
}

// =====================================================================
// MARK READ
// =====================================================================

async function markRead(notifId, userId) {
    await pool.execute(
        `UPDATE notifications SET is_read = 1, read_at = NOW()
         WHERE id = ? AND user_id = ? AND is_read = 0`,
        [notifId, userId]
    );
}

async function markAllRead(userId) {
    await pool.execute(
        `UPDATE notifications SET is_read = 1, read_at = NOW()
         WHERE user_id = ? AND is_read = 0`,
        [userId]
    );
}

module.exports = {
    send,
    broadcast,
    broadcastToGursSiswa,
    getForUser,
    getUnreadCount,
    markRead,
    markAllRead,
};
