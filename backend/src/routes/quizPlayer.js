const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const {
    getQuizAccess,
    startAttempt,
    getAttemptData,
    saveAttempt,
    submitAttempt,
    getAttemptSummary,
    getMoodleToken
} = require('../services/quizPlayerService');
const { getHasilSiswa } = require('../services/moodleService');
const { simpanHasil, getHasilFromDB } = require('../services/dbService');
const { generateAnalisis } = require('../services/aiService');
const { panggilAPI } = require('../config/moodle');

// Semua route butuh auth
router.use(authMiddleware);

/**
 * Helper: ambil Moodle token untuk user yang sedang login
 * Token Moodle user disimpan di req.user setelah dapat dari plugin
 */
async function getMoodleTokenForUser(req) {
    // Jika sudah punya moodle token (dari login flow baru), pakai langsung
    if (req.user.moodleToken) return req.user.moodleToken;

    // Fallback: ambil via plugin
    const tokenData = await getMoodleToken(req.user.username);
    return tokenData.token;
}

// ─────────────────────────────────────────────
// GET /api/quiz-player/:quizId/access
// Cek apakah user bisa attempt quiz ini
// ─────────────────────────────────────────────
router.get('/:quizId/access', async (req, res, next) => {
    try {
        const quizId = parseInt(req.params.quizId);
        const moodleToken = await getMoodleTokenForUser(req);
        const access = await getQuizAccess(moodleToken, quizId);

        res.json({
            can_attempt: access.canattempt || false,
            is_closed: access.isfinished || false,
            prevent_access: access.preventaccessreasons || [],
            time_close: access.timeclose || null,
            time_open: access.timeopen || null,
        });
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
        const moodleToken = await getMoodleTokenForUser(req);
        const result = await startAttempt(moodleToken, quizId);

        res.json(result);
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/quiz-player/:quizId/attempt/:attemptId
// Ambil data soal (semua sekaligus dengan page=-1 tidak didukung,
// kita ambil per halaman lalu gabungkan)
// ─────────────────────────────────────────────
router.get('/:quizId/attempt/:attemptId', async (req, res, next) => {
    try {
        const attemptId = parseInt(req.params.attemptId);
        const page = parseInt(req.query.page ?? '-1');
        const moodleToken = await getMoodleTokenForUser(req);

        // Moodle tidak support page=-1 untuk get_attempt_data
        // Kita ambil semua halaman secara iteratif
        if (page === -1) {
            const allQuestions = [];
            let currentPage = 0;
            let attemptInfo = null;

            while (true) {
                const data = await getAttemptData(moodleToken, attemptId, currentPage);
                if (!attemptInfo) attemptInfo = data.attempt;
                allQuestions.push(...data.questions);

                if (data.next_page === -1 || data.questions.length === 0) break;
                currentPage = data.next_page;
            }

            return res.json({
                attempt_id: attemptId,
                attempt: attemptInfo,
                questions: allQuestions,
                total_questions: allQuestions.length
            });
        }

        // Ambil halaman spesifik
        const data = await getAttemptData(moodleToken, attemptId, page);
        res.json(data);
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/quiz-player/:quizId/attempt/:attemptId/summary
// Ringkasan semua soal (untuk halaman konfirmasi sebelum submit)
// ─────────────────────────────────────────────
router.get('/:quizId/attempt/:attemptId/summary', async (req, res, next) => {
    try {
        const attemptId = parseInt(req.params.attemptId);
        const moodleToken = await getMoodleTokenForUser(req);
        const summary = await getAttemptSummary(moodleToken, attemptId);
        res.json(summary);
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// POST /api/quiz-player/:quizId/attempt/:attemptId/save
// Auto-save jawaban
// ─────────────────────────────────────────────
router.post('/:quizId/attempt/:attemptId/save', async (req, res, next) => {
    try {
        const attemptId = parseInt(req.params.attemptId);
        const { data } = req.body; // array of { name, value }

        if (!Array.isArray(data)) {
            return res.status(400).json({ error: 'data harus berupa array' });
        }

        const moodleToken = await getMoodleTokenForUser(req);
        const result = await saveAttempt(moodleToken, attemptId, data);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// POST /api/quiz-player/:quizId/attempt/:attemptId/submit
// Submit attempt (selesaikan tryout)
// ─────────────────────────────────────────────
router.post('/:quizId/attempt/:attemptId/submit', async (req, res, next) => {
    try {
        const quizId = parseInt(req.params.quizId);
        const attemptId = parseInt(req.params.attemptId);
        const { data = [] } = req.body;
        const moodleToken = await getMoodleTokenForUser(req);

        // Submit ke Moodle
        await submitAttempt(moodleToken, attemptId, data);

        // Ambil hasil dari Moodle dan simpan ke DB
        try {
            const hasil = await getHasilSiswa(req.user.id, quizId);
            if (hasil) {
                // Ambil info quiz
                const quizList = await panggilAPI('mod_quiz_get_quizzes_by_courses', {
                    'courseids[0]': process.env.MOODLE_COURSE_ID || 2
                });
                const quiz = (quizList.quizzes || []).find(q => q.id === quizId);

                // Generate AI insight
                let aiInsight = null;
                try {
                    aiInsight = await generateAnalisis(
                        req.user.nama,
                        hasil.per_subtes,
                        quiz?.name || `Quiz ${quizId}`
                    );
                } catch (aiErr) {
                    console.warn('AI insight gagal:', aiErr.message);
                }

                // Simpan ke DB
                await simpanHasil({
                    attempt_id: attemptId,
                    user_id: req.user.id,
                    quiz_id: quizId,
                    nama_siswa: req.user.nama,
                    nama_tryout: quiz?.name || `Quiz ${quizId}`,
                    waktu_selesai: hasil.waktu_selesai,
                    skor_subtes: {
                        per_subtes: hasil.per_subtes,
                        total: hasil.total
                    },
                    analisis_soal: {},
                    ai_insight: aiInsight
                });
            }
        } catch (postErr) {
            console.warn('Post-submit processing error:', postErr.message);
        }

        res.json({ success: true, redirect: `/siswa/hasil/${quizId}` });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
