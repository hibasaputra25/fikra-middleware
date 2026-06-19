const express = require('express');
const router = express.Router();
const { getHasilSiswa, getSiswa, getQuizzes } = require('../services/moodleService');
const { simpanHasil, getHasilFromDB, getRanking } = require('../services/dbService');
const { generateAnalisis } = require('../services/aiService');

// GET /api/results/ranking/:quizId — HARUS sebelum /:userId/:quizId
router.get('/ranking/:quizId', async (req, res, next) => {
    try {
        const quizId = parseInt(req.params.quizId);
        const ranking = await getRanking(quizId);
        res.json({ quiz_id: quizId, total: ranking.length, data: ranking });
    } catch (err) {
        next(err);
    }
});

// GET /api/results/:userId/:quizId
router.get('/:userId/:quizId', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        const quizId = parseInt(req.params.quizId);
        const forceRefresh = req.query.refresh === 'true';

        if (!forceRefresh) {
            const cached = await getHasilFromDB(userId, quizId);
            if (cached) {
                const skorSubtes = cached.skor_subtes || {};
                return res.json({
                    source: 'db',
                    attempt_id: cached.attempt_id,
                    waktu_selesai: cached.waktu_selesai,
                    quiz_info: skorSubtes.quiz_info || null,
                    per_subtes: skorSubtes.per_subtes || {},
                    total: skorSubtes.total || { benar: 0, total: 0, skor: 0 },
                    ai_insight: cached.ai_insight || null
                });
            }
        }

        const hasil = await getHasilSiswa(userId, quizId);
        if (!hasil) {
            return res.status(404).json({ error: 'Siswa belum mengerjakan tryout ini' });
        }

        const [siswaList, quizList] = await Promise.all([getSiswa(), getQuizzes()]);
        const siswa = siswaList.find(s => s.id === userId);
        const quiz = quizList.find(q => q.id === quizId);

        let aiInsight = null;
        try {
            aiInsight = await generateAnalisis(
                siswa?.nama || `User ${userId}`,
                hasil.per_subtes,
                quiz?.nama || `Quiz ${quizId}`
            );
        } catch (aiErr) {
            console.warn('⚠️ AI insight gagal:', aiErr.message);
        }

        await simpanHasil({
            attempt_id: hasil.attempt_id,
            user_id: userId,
            quiz_id: quizId,
            nama_siswa: siswa?.nama || `User ${userId}`,
            nama_tryout: quiz?.nama || `Quiz ${quizId}`,
            waktu_selesai: hasil.waktu_selesai,
            skor_subtes: { per_subtes: hasil.per_subtes, total: hasil.total },
            analisis_soal: {},
            ai_insight: aiInsight
        });

        res.json({
            source: 'moodle',
            attempt_id: hasil.attempt_id,
            attempt_ke: hasil.attempt_ke,
            waktu_mulai: hasil.waktu_mulai,
            waktu_selesai: hasil.waktu_selesai,
            durasi_menit: hasil.durasi_menit,
            quiz_info: hasil.quiz_info,
            per_subtes: hasil.per_subtes,
            total: hasil.total,
            ai_insight: aiInsight
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;