const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const notif = require('../services/notificationService');

// Semua route butuh auth
router.use(authMiddleware);

// GET /api/notifications
// List notifikasi user yang login (20 terbaru, paginasi via ?offset=)
router.get('/', async (req, res, next) => {
    try {
        const limit  = Math.min(parseInt(req.query.limit  || '20'), 50);
        const offset = parseInt(req.query.offset || '0');
        const data   = await notif.getForUser(req.user.id, { limit, offset });
        res.json({ data, total: data.length });
    } catch (err) { next(err); }
});

// GET /api/notifications/unread-count
// Hanya return jumlah unread — dipakai polling setiap 60 detik di navbar
router.get('/unread-count', async (req, res, next) => {
    try {
        const count = await notif.getUnreadCount(req.user.id);
        res.json({ count });
    } catch (err) { next(err); }
});

// PUT /api/notifications/read-all — HARUS sebelum /:id/read
// Tandai semua notif sebagai sudah dibaca
router.put('/read-all', async (req, res, next) => {
    try {
        await notif.markAllRead(req.user.id);
        res.json({ success: true });
    } catch (err) { next(err); }
});

// PUT /api/notifications/:id/read
// Tandai satu notif sebagai sudah dibaca
router.put('/:id/read', async (req, res, next) => {
    try {
        await notif.markRead(parseInt(req.params.id), req.user.id);
        res.json({ success: true });
    } catch (err) { next(err); }
});

module.exports = router;
