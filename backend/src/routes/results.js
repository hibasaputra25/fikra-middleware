const express = require('express');
const router = express.Router();
const { getHasilSiswa, getSiswa, getQuizzes } = require('../services/moodleService');
const { simpanHasil, getHasilFromDB, getRanking } = require('../services/dbService');
const { generateAnalisis } = require('../services/aiService');

// GET /api/results/:userId/:quizId
// Ambil hasil tryout siswa — cek DB dulu, fallback ke Moodle
router.get('/:userId/:quizId', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        const quizId = parseInt(req.params.quizId);
        const forceRefresh = req.query.refresh === 'true';

        // Cek DB dulu kecuali diminta refresh
        if (!forceRefresh) {
            const cached = await getHasilFromDB(userId, quizId);
            if (cached) {
                return res.json({ source: 'db', ...cached });
            }
        }

        // Ambil dari Moodle
        const hasil = await getHasilSiswa(userId, quizId);

        if (!hasil) {
            return res.status(404).json({
                error: 'Siswa belum mengerjakan tryout ini'
            });
        }

        // Ambil info siswa dan quiz untuk disimpan
        const [siswaList, quizList] = await Promise.all([
            getSiswa(),
            getQuizzes()
        ]);

        const siswa = siswaList.find(s => s.id === userId);
        const quiz = quizList.find(q => q.id === quizId);

        // Generate AI insight
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

        // Simpan ke DB
        await simpanHasil({
            attempt_id: hasil.attempt_id,
            user_id: userId,
            quiz_id: quizId,
            nama_siswa: siswa?.nama || `User ${userId}`,
            nama_tryout: quiz?.nama || `Quiz ${quizId}`,
            waktu_selesai: hasil.waktu_selesai,
            skor_subtes: {
                per_subtes: hasil.per_subtes,
                total: hasil.total
            },
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

// GET /api/results/:quizId/ranking
// Ranking semua siswa untuk quiz tertentu
router.get('/:quizId/ranking', async (req, res, next) => {
    try {
        const quizId = parseInt(req.params.quizId);
        const ranking = await getRanking(quizId);

        res.json({
            quiz_id: quizId,
            total: ranking.length,
            data: ranking
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;