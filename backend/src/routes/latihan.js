const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const {
    getPaketByKategori,
    getPaketById,
    createPaket,
    updatePaket,
    deletePaket,
    setPaketQuestions,
    startAttempt,
    saveAnswer,
    submitAttempt,
    getAttemptResult,
    getRiwayatSiswa
} = require('../services/latihanService');

// =====================================================================
// PUBLIC (butuh auth)
// =====================================================================

// GET /api/latihan
// Daftar semua paket dikelompokkan per kategori
// Siswa: hanya paket dari guru yang mengajar mereka + admin
// Guru : hanya paket yang mereka buat sendiri
// Admin: semua paket
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const { role, id } = req.user;
        let userId = null;
        if (role === 'siswa') userId = id;  // filter by guru yang mengajar
        const data = await getPaketByKategori(userId);
        res.json({ data });
    } catch (err) {
        next(err);
    }
});

// GET /api/latihan/riwayat
// Riwayat latihan siswa
router.get('/riwayat', authMiddleware, async (req, res, next) => {
    try {
        const data = await getRiwayatSiswa(req.user.id);
        res.json({ data });
    } catch (err) {
        next(err);
    }
});

// GET /api/latihan/paket/:paketId/active-attempt
// Cek apakah user punya attempt in_progress untuk paket ini
// HARUS sebelum /paket/:paketId
router.get('/paket/:paketId/active-attempt', authMiddleware, async (req, res, next) => {
    try {
        const paketId = parseInt(req.params.paketId);
        const { pool } = require('../config/db');
        const now = new Date();

        const [[attempt]] = await pool.execute(
            `SELECT id, started_at, due_at, status
             FROM latihan_attempts
             WHERE paket_id = ? AND user_id = ? AND status = 'in_progress'
             ORDER BY id DESC LIMIT 1`,
            [paketId, req.user.id]
        );

        // Ambil riwayat selesai
        const [[submitted]] = await pool.execute(
            `SELECT COUNT(*) as total, MAX(total_score) as best_score, MAX(finished_at) as last_finished
             FROM latihan_attempts
             WHERE paket_id = ? AND user_id = ? AND status = 'submitted'`,
            [paketId, req.user.id]
        );

        const completedCount = submitted?.total || 0;
        const bestScore      = submitted?.best_score || null;
        const lastFinished   = submitted?.last_finished || null;

        if (!attempt) {
            return res.json({ active: false, attempt: null, completed_count: completedCount, best_score: bestScore, last_finished: lastFinished });
        }

        // Cek apakah waktu sudah habis
        if (attempt.due_at && now > new Date(attempt.due_at)) {
            await pool.execute(
                `UPDATE latihan_attempts SET status = 'abandoned' WHERE id = ?`,
                [attempt.id]
            );
            return res.json({ active: false, attempt: null, completed_count: completedCount, best_score: bestScore, last_finished: lastFinished });
        }

        const time_left_seconds = attempt.due_at
            ? Math.max(0, Math.floor((new Date(attempt.due_at) - now) / 1000))
            : null;

        res.json({ active: true, attempt: { ...attempt, time_left_seconds }, completed_count: completedCount, best_score: bestScore, last_finished: lastFinished });
    } catch (err) {
        next(err);
    }
});

// GET /api/latihan/paket/:paketId
// Detail paket beserta soal-soalnya
router.get('/paket/:paketId', authMiddleware, async (req, res, next) => {
    try {
        const paket = await getPaketById(parseInt(req.params.paketId));
        if (!paket) return res.status(404).json({ error: 'Paket tidak ditemukan' });
        res.json(paket);
    } catch (err) {
        next(err);
    }
});

// POST /api/latihan/paket/:paketId/start
// Mulai atau lanjutkan attempt latihan
router.post('/paket/:paketId/start', authMiddleware, async (req, res, next) => {
    try {
        const paketId = parseInt(req.params.paketId);
        const result = await startAttempt(paketId, req.user.id);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// POST /api/latihan/attempt/:attemptId/answer
// Simpan jawaban satu soal
router.post('/attempt/:attemptId/answer', authMiddleware, async (req, res, next) => {
    try {
        const attemptId = parseInt(req.params.attemptId);
        const { question_id, selected_option_ids, answer_text, is_flagged, sequence_token } = req.body;

        if (!question_id) return res.status(400).json({ error: 'question_id wajib diisi' });

        await saveAnswer(attemptId, question_id, {
            selected_option_ids,
            answer_text,
            is_flagged,
            sequence_token
        });

        res.json({ success: true });
    } catch (err) {
        if (err.message === 'Waktu pengerjaan sudah habis') {
            return res.status(403).json({ error: err.message, code: 'TIME_EXPIRED' });
        }
        if (err.message === 'Token tidak valid') {
            return res.status(400).json({ error: err.message, code: 'INVALID_TOKEN' });
        }
        next(err);
    }
});

// POST /api/latihan/attempt/:attemptId/submit
// Submit attempt dan hitung skor
router.post('/attempt/:attemptId/submit', authMiddleware, async (req, res, next) => {
    try {
        const attemptId = parseInt(req.params.attemptId);
        const result = await submitAttempt(attemptId, req.user.id);
        res.json({ success: true, ...result });
    } catch (err) {
        if (err.message === 'Waktu pengerjaan sudah habis') {
            return res.status(403).json({ error: err.message, code: 'TIME_EXPIRED' });
        }
        if (err.message === 'Attempt sudah disubmit') {
            return res.status(409).json({ error: err.message, code: 'ALREADY_SUBMITTED' });
        }
        if (err.message === 'Attempt sudah berakhir') {
            return res.status(409).json({ error: err.message, code: 'ATTEMPT_ABANDONED' });
        }
        next(err);
    }
});

// GET /api/latihan/attempt/:attemptId/result
// Hasil latihan dengan detail per soal
router.get('/attempt/:attemptId/result', authMiddleware, async (req, res, next) => {
    try {
        const attemptId = parseInt(req.params.attemptId);
        const result = await getAttemptResult(attemptId, req.user.id);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// ADMIN (perlu role check — untuk sementara pakai authMiddleware)
// =====================================================================

// GET /api/latihan/admin/paket
// List semua paket untuk admin (termasuk yang tidak aktif)
router.get('/admin/paket', authMiddleware, requireRole('admin', 'guru'), async (req, res, next) => {
    try {
        const { pool } = require('../config/db');
        const [rows] = await pool.execute(`
            SELECT lp.*, c.name AS category_name, c.code AS category_code,
                   COUNT(lpq.id) AS question_count
            FROM latihan_paket lp
            LEFT JOIN categories c ON c.id = lp.category_id
            LEFT JOIN latihan_paket_questions lpq ON lpq.paket_id = lp.id
            GROUP BY lp.id
            ORDER BY c.sort_order ASC, lp.sort_order ASC
        `);
        res.json({ data: rows, total: rows.length });
    } catch (err) {
        next(err);
    }
});

// POST /api/latihan/admin/paket
// Buat paket baru
router.post('/admin/paket', authMiddleware, requireRole('admin', 'guru'), async (req, res, next) => {
    try {
        const id = await createPaket({ ...req.body, created_by: req.user.id });
        const paket = await getPaketById(id);
        res.status(201).json(paket);
    } catch (err) {
        next(err);
    }
});

// PUT /api/latihan/admin/paket/:paketId
// Update paket
router.put('/admin/paket/:paketId', authMiddleware, requireRole('admin', 'guru'), async (req, res, next) => {
    try {
        const paketId = parseInt(req.params.paketId);
        await updatePaket(paketId, req.body);
        const paket = await getPaketById(paketId);
        res.json(paket);
    } catch (err) {
        next(err);
    }
});

// DELETE /api/latihan/admin/paket/:paketId
// Hapus paket
router.delete('/admin/paket/:paketId', authMiddleware, requireRole('admin', 'guru'), async (req, res, next) => {
    try {
        await deletePaket(parseInt(req.params.paketId));
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// PUT /api/latihan/admin/paket/:paketId/questions
// Set soal dalam paket (replace all)
router.put('/admin/paket/:paketId/questions', authMiddleware, requireRole('admin', 'guru'), async (req, res, next) => {
    try {
        const paketId = parseInt(req.params.paketId);
        const { question_ids } = req.body;

        if (!Array.isArray(question_ids)) {
            return res.status(400).json({ error: 'question_ids harus berupa array' });
        }

        await setPaketQuestions(paketId, question_ids);
        res.json({ success: true, total: question_ids.length });
    } catch (err) {
        next(err);
    }
});

// POST /api/latihan/admin/paket/:paketId/questions/append
// Tambah soal ke paket (tanpa hapus yang sudah ada)
router.post('/admin/paket/:paketId/questions/append', authMiddleware, requireRole('admin', 'guru'), async (req, res, next) => {
    try {
        const paketId = parseInt(req.params.paketId);
        const { question_ids } = req.body;

        if (!Array.isArray(question_ids) || question_ids.length === 0) {
            return res.status(400).json({ error: 'question_ids harus berupa array tidak kosong' });
        }

        const { pool } = require('../config/db');

        // Ambil sort_order tertinggi yang sudah ada
        const [[{ maxOrder }]] = await pool.execute(
            'SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM latihan_paket_questions WHERE paket_id = ?',
            [paketId]
        );

        // Insert soal baru (skip duplikat)
        let added = 0;
        for (let i = 0; i < question_ids.length; i++) {
            const qId = parseInt(question_ids[i]);
            try {
                await pool.execute(
                    `INSERT IGNORE INTO latihan_paket_questions (paket_id, question_id, sort_order, marks)
                     VALUES (?, ?, ?, 1.00)`,
                    [paketId, qId, maxOrder + i + 1]
                );
                added++;
            } catch { /* skip */ }
        }

        // Update total_questions
        await pool.execute(
            'UPDATE latihan_paket SET total_questions = (SELECT COUNT(*) FROM latihan_paket_questions WHERE paket_id = ?) WHERE id = ?',
            [paketId, paketId]
        );

        res.json({ success: true, added });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
