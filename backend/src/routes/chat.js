const express = require('express');
const router  = express.Router();
const { chat } = require('../services/aiService');
const { getHasilFromDB } = require('../services/dbService');
const { authMiddleware } = require('../middleware/auth');
const { pool } = require('../config/db');

// Limit harian per plan
const DAILY_LIMITS = {
    free:    5,
    premium: 50,
};

// =====================================================================
// HELPERS: cek & increment usage harian
// =====================================================================
async function getChatUsage(userId) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const [[row]] = await pool.execute(
        'SELECT count FROM ai_chat_usage WHERE user_id = ? AND date = ? LIMIT 1',
        [userId, today]
    );
    return row ? row.count : 0;
}

async function incrementChatUsage(userId) {
    const today = new Date().toISOString().slice(0, 10);
    await pool.execute(
        `INSERT INTO ai_chat_usage (user_id, date, count) VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE count = count + 1`,
        [userId, today]
    );
}

async function getUserPlan(userId) {
    const [[sub]] = await pool.execute(
        `SELECT plan, status, expires_at FROM subscriptions
         WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
        [userId]
    );
    if (!sub) return 'free';
    // Auto-check expiry
    if (sub.plan === 'premium' && sub.expires_at && new Date(sub.expires_at) < new Date()) {
        return 'free';
    }
    return sub.status === 'active' ? sub.plan : 'free';
}

// =====================================================================
// GET /api/chat/usage
// Return sisa limit hari ini
// =====================================================================
router.get('/usage', authMiddleware, async (req, res, next) => {
    try {
        const plan  = await getUserPlan(req.user.id);
        const limit = DAILY_LIMITS[plan] ?? DAILY_LIMITS.free;
        const used  = await getChatUsage(req.user.id);
        res.json({
            plan,
            used,
            limit,
            remaining: Math.max(0, limit - used),
        });
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// POST /api/chat
// Chat dengan Kak Fikra AI
// Body: { quizId?, messages: [{role, content}] }
// =====================================================================
router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { quizId, messages, userId: _legacyUserId } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'messages wajib diisi' });
        }

        // Validasi format messages
        const validMessages = messages.filter(m =>
            m.role && m.content &&
            ['user', 'assistant'].includes(m.role)
        );
        if (validMessages.length === 0) {
            return res.status(400).json({ error: 'Format messages tidak valid' });
        }

        // Cek rate limit harian
        const plan    = await getUserPlan(userId);
        const limit   = DAILY_LIMITS[plan] ?? DAILY_LIMITS.free;
        const used    = await getChatUsage(userId);
        if (used >= limit) {
            return res.status(429).json({
                error: `Limit chat harian kamu sudah habis (${limit}/${limit}). ${
                    plan === 'free'
                        ? 'Upgrade ke Premium untuk limit lebih banyak!'
                        : 'Coba lagi besok ya!'
                }`,
                code:      'DAILY_LIMIT_EXCEEDED',
                plan,
                used,
                limit,
            });
        }

        // Ambil data performa siswa
        let nilaiPerSubtes = {};
        let namaSiswa      = req.user.nama || `Siswa ${userId}`;

        if (quizId) {
            try {
                const hasil = await getHasilFromDB(userId, quizId);
                if (hasil) {
                    nilaiPerSubtes = hasil.skor_subtes?.per_subtes || {};
                    namaSiswa      = hasil.nama_siswa || namaSiswa;
                }
            } catch (e) {
                console.warn('⚠️ Gagal ambil data hasil untuk chat:', e.message);
            }
        }

        // Panggil AI
        const reply = await chat(validMessages, namaSiswa, nilaiPerSubtes);

        // Increment usage SETELAH berhasil
        await incrementChatUsage(userId);

        res.json({
            role:      'assistant',
            content:   reply,
            usage: {
                used:      used + 1,
                limit,
                remaining: Math.max(0, limit - used - 1),
            },
        });
    } catch (err) {
        if (err.message.includes('rate_limit')) {
            return res.status(429).json({
                error: 'Kak Fikra lagi istirahat sebentar, coba lagi dalam beberapa detik ya!'
            });
        }
        next(err);
    }
});

module.exports = router;
