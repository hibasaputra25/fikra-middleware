const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
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
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const data = await getPaketByKategori();
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
        const { question_id, selected_option_ids, answer_text, is_flagged } = req.body;

        if (!question_id) return res.status(400).json({ error: 'question_id wajib diisi' });

        await saveAnswer(attemptId, question_id, {
            selected_option_ids,
            answer_text,
            is_flagged
        });

        res.json({ success: true });
    } catch (err) {
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
router.get('/admin/paket', authMiddleware, async (req, res, next) => {
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
router.post('/admin/paket', authMiddleware, async (req, res, next) => {
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
router.put('/admin/paket/:paketId', authMiddleware, async (req, res, next) => {
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
router.delete('/admin/paket/:paketId', authMiddleware, async (req, res, next) => {
    try {
        await deletePaket(parseInt(req.params.paketId));
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// PUT /api/latihan/admin/paket/:paketId/questions
// Set soal dalam paket (replace all)
router.put('/admin/paket/:paketId/questions', authMiddleware, async (req, res, next) => {
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

module.exports = router;
