const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const {
    getQuizAccess,
    startAttempt,
    getAttemptData,
    saveAttempt,
    getAttemptSummary,
    submitAttemptTransactional,
} = require('../services/quizPlayerService');
const { simpanHasil, getHasilFromDB } = require('../services/dbService');
const { generateAnalisis } = require('../services/aiService');

// Semua route butuh auth
router.use(authMiddleware);

// ─────────────────────────────────────────────
// GET /api/quiz-player/:quizId/access
// Cek apakah user bisa attempt tryout ini
// ─────────────────────────────────────────────
router.get('/:quizId/access', async (req, res, next) => {
    try {
        const quizId = parseInt(req.params.quizId);
        if (isNaN(quizId)) return res.status(400).json({ error: 'ID tidak valid' });

        const access = await getQuizAccess(req.user.id, quizId);
        res.json(access);
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// POST /api/quiz-player/:quizId/start
// Mulai atau lanjutkan attempt
// ─────────────────────────────────────────────
router.post('/:quizId/start', async (req, res, next) => {
    try {
        const quizId = parseInt(req.params.quizId);
        if (isNaN(quizId)) return res.status(400).json({ error: 'ID tidak valid' });

        // Pastikan bisa attempt dulu
        const access = await getQuizAccess(req.user.id, quizId);
        if (!access.can_attempt) {
            return res.status(403).json({ error: access.reason || 'Tidak bisa attempt' });
        }

        const result = await startAttempt(req.user.id, quizId);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/quiz-player/:quizId/attempt/:attemptId
// Ambil soal untuk halaman/section tertentu
// page = index section (0-based), -1 = semua
// ─────────────────────────────────────────────
router.get('/:quizId/attempt/:attemptId', async (req, res, next) => {
    try {
        const attemptId = parseInt(req.params.attemptId);
        const page = parseInt(req.query.page ?? 0);
        if (isNaN(attemptId)) return res.status(400).json({ error: 'ID tidak valid' });

        const data = await getAttemptData(req.user.id, attemptId, page);
        res.json(data);
    } catch (err) {
        if (err.message.includes('habis') || err.message.includes('selesai')) {
            return res.status(403).json({ error: err.message });
        }
        next(err);
    }
});

// ─────────────────────────────────────────────
// POST /api/quiz-player/:quizId/attempt/:attemptId/save
// Auto-save jawaban siswa
// ─────────────────────────────────────────────
router.post('/:quizId/attempt/:attemptId/save', async (req, res, next) => {
    try {
        const attemptId = parseInt(req.params.attemptId);
        if (isNaN(attemptId)) return res.status(400).json({ error: 'ID tidak valid' });

        const { answers } = req.body;
        if (!Array.isArray(answers)) {
            return res.status(400).json({ error: 'answers harus berupa array' });
        }

        const result = await saveAttempt(req.user.id, attemptId, answers);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/quiz-player/:quizId/attempt/:attemptId/summary
// Ringkasan soal (dijawab/belum/diflag) sebelum submit
// ─────────────────────────────────────────────
router.get('/:quizId/attempt/:attemptId/summary', async (req, res, next) => {
    try {
        const attemptId = parseInt(req.params.attemptId);
        if (isNaN(attemptId)) return res.status(400).json({ error: 'ID tidak valid' });

        const summary = await getAttemptSummary(req.user.id, attemptId);
        res.json(summary);
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// POST /api/quiz-player/:quizId/attempt/:attemptId/submit
// Submit attempt — hitung skor, simpan hasil
// ─────────────────────────────────────────────
router.post('/:quizId/attempt/:attemptId/submit', async (req, res, next) => {
    try {
        const quizId = parseInt(req.params.quizId);
        const attemptId = parseInt(req.params.attemptId);
        if (isNaN(quizId) || isNaN(attemptId)) {
            return res.status(400).json({ error: 'ID tidak valid' });
        }

        const hasil = await submitAttemptTransactional(req.user.id, attemptId);

        // Proses post-submit: AI insight + simpan ke tryout_results
        try {
            let aiInsight = null;
            try {
                aiInsight = await generateAnalisis(hasil);
            } catch (aiErr) {
                console.warn('AI insight gagal:', aiErr.message);
            }

            await simpanHasil({
                attempt_id: attemptId,
                user_id: req.user.id,
                quiz_id: quizId,
                nama_siswa: req.user.nama,
                nama_tryout: `Tryout ${quizId}`,
                waktu_selesai: new Date().toISOString(),
                skor_subtes: {
                    per_subtes: hasil.score_per_section,
                    total: { skor: hasil.total_score }
                },
                analisis_soal: {},
                ai_insight: aiInsight
            });
        } catch (postErr) {
            console.warn('Post-submit processing error:', postErr.message);
        }

        res.json({
            success: true,
            total_score: hasil.total_score,
            score_per_section: hasil.score_per_section,
            time_spent_seconds: hasil.time_spent_seconds,
            redirect: `/siswa/hasil/${quizId}`
        });
    } catch (err) {
        if (err.message.includes('sudah disubmit')) {
            return res.status(409).json({ error: err.message });
        }
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/quiz-player/:quizId/hasil
// Ambil hasil tryout dari DB
// ─────────────────────────────────────────────
router.get('/:quizId/hasil', async (req, res, next) => {
    try {
        const quizId = parseInt(req.params.quizId);
        if (isNaN(quizId)) return res.status(400).json({ error: 'ID tidak valid' });

        const hasil = await getHasilFromDB(req.user.id, quizId);
        if (!hasil) return res.status(404).json({ error: 'Hasil tidak ditemukan' });

        res.json(hasil);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
