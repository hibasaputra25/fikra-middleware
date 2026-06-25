const express = require('express');
const router  = express.Router();
const { pool } = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { generateAnalisis } = require('../services/aiService');

// GET /api/results/ranking/:tryoutId (HARUS sebelum /:userId/:tryoutId)
// Ranking semua siswa untuk satu tryout
router.get('/ranking/:tryoutId', authMiddleware, async (req, res, next) => {
    try {
        const tryoutId = parseInt(req.params.tryoutId);

        const [rows] = await pool.execute(`
            SELECT
                ta.user_id,
                u.nama AS nama_siswa,
                u.username,
                ta.total_score,
                ta.finished_at,
                ta.time_spent_seconds,
                ROW_NUMBER() OVER (ORDER BY ta.total_score DESC, ta.time_spent_seconds ASC) AS rank_pos
            FROM tryout_attempts ta
            JOIN users u ON u.id = ta.user_id
            WHERE ta.tryout_id = ? AND ta.status = 'submitted'
            ORDER BY ta.total_score DESC, ta.time_spent_seconds ASC
        `, [tryoutId]);

        res.json({ tryout_id: tryoutId, total: rows.length, data: rows });
    } catch (err) {
        next(err);
    }
});

// GET /api/results/me
// Semua hasil tryout milik user yang login
router.get('/me', authMiddleware, async (req, res, next) => {
    try {
        const [rows] = await pool.execute(`
            SELECT
                ta.id, ta.tryout_id, ta.attempt_number,
                ta.status, ta.started_at, ta.finished_at,
                ta.time_spent_seconds, ta.total_score,
                t.name AS tryout_name, t.type AS tryout_type
            FROM tryout_attempts ta
            JOIN tryouts t ON t.id = ta.tryout_id
            WHERE ta.user_id = ? AND ta.status = 'submitted'
            ORDER BY ta.finished_at DESC
        `, [req.user.id]);

        res.json({ total: rows.length, data: rows });
    } catch (err) {
        next(err);
    }
});

// GET /api/results/:userId/:tryoutId
// Hasil tryout seorang siswa — diakses oleh siswa sendiri atau guru/admin
router.get('/:userId/:tryoutId', authMiddleware, async (req, res, next) => {
    try {
        const userId   = parseInt(req.params.userId);
        const tryoutId = parseInt(req.params.tryoutId);

        // Siswa hanya bisa lihat hasil sendiri
        if (req.user.role === 'siswa' && req.user.id !== userId) {
            return res.status(403).json({ error: 'Akses ditolak' });
        }

        // Ambil attempt terakhir yang submitted
        const [[attempt]] = await pool.execute(`
            SELECT
                ta.*,
                t.name  AS tryout_name,
                t.type  AS tryout_type,
                u.nama  AS nama_siswa,
                u.username
            FROM tryout_attempts ta
            JOIN tryouts t ON t.id = ta.tryout_id
            JOIN users   u ON u.id = ta.user_id
            WHERE ta.tryout_id = ? AND ta.user_id = ? AND ta.status = 'submitted'
            ORDER BY ta.attempt_number DESC
            LIMIT 1
        `, [tryoutId, userId]);

        if (!attempt) {
            return res.status(404).json({ error: 'Hasil tidak ditemukan' });
        }

        // Ambil detail jawaban per section
        const [sections] = await pool.execute(`
            SELECT
                ts.id AS section_id, ts.name AS section_name,
                ts.sort_order, ts.total_questions,
                COUNT(taa.id)                                          AS answered,
                SUM(CASE WHEN taa.is_correct = 1 THEN 1 ELSE 0 END)   AS correct,
                SUM(CASE WHEN taa.is_correct = 0 THEN 1 ELSE 0 END)   AS wrong,
                SUM(COALESCE(taa.marks_earned, 0))                     AS marks_earned
            FROM tryout_sections ts
            LEFT JOIN tryout_attempt_answers taa
                ON taa.section_id = ts.id AND taa.attempt_id = ?
            WHERE ts.tryout_id = ?
            GROUP BY ts.id
            ORDER BY ts.sort_order ASC
        `, [attempt.id, tryoutId]);

        // Hitung skor per section (0-1000 scale)
        const skor_subtes = {};
        for (const s of sections) {
            const total = parseInt(s.total_questions) || 0;
            const benar = parseInt(s.correct) || 0;
            skor_subtes[s.section_name] = {
                label:   s.section_name,
                benar,
                salah:   parseInt(s.wrong) || 0,
                total,
                skor:    total > 0 ? Math.round((benar / total) * 1000) : 0
            };
        }

        // Generate AI insight jika belum ada dan diminta
        let ai_insight = attempt.ai_insight;
        if (!ai_insight && req.query.refresh === 'true') {
            try {
                ai_insight = await generateAnalisis(
                    attempt.nama_siswa,
                    skor_subtes,
                    attempt.tryout_name
                );
                await pool.execute(
                    'UPDATE tryout_attempts SET ai_insight = ? WHERE id = ?',
                    [ai_insight, attempt.id]
                );
            } catch (err) {
                console.warn('AI insight gagal:', err.message);
            }
        }

        res.json({
            attempt_id:    attempt.id,
            attempt_ke:    attempt.attempt_number,
            tryout_id:     attempt.tryout_id,
            tryout_name:   attempt.tryout_name,
            nama_siswa:    attempt.nama_siswa,
            username:      attempt.username,
            waktu_mulai:   attempt.started_at,
            waktu_selesai: attempt.finished_at,
            durasi_menit:  attempt.time_spent_seconds
                ? Math.round(attempt.time_spent_seconds / 60) : null,
            total_score:   attempt.total_score,
            skor_subtes,
            ai_insight,
            sections
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
