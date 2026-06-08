const express = require('express');
const router = express.Router();
const { getQuizzes } = require('../services/moodleService');
const { mappingData } = require('../config/mapping');

// GET /api/quizzes
// List semua tryout aktif
router.get('/', async (req, res, next) => {
    try {
        const quizzes = await getQuizzes();

        // Tambahkan info mapping jika tersedia
        const quizzesWithMapping = quizzes.map(q => ({
            ...q,
            has_mapping: !!mappingData.quiz[String(q.id)],
            tipe: mappingData.quiz[String(q.id)]?.tipe || null
        }));

        res.json({
            total: quizzesWithMapping.length,
            data: quizzesWithMapping
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/quizzes/:id
// Detail satu quiz
router.get('/:id', async (req, res, next) => {
    try {
        const quizId = parseInt(req.params.id);
        const quizzes = await getQuizzes();
        const quiz = quizzes.find(q => q.id === quizId);

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz tidak ditemukan' });
        }

        const mapping = mappingData.quiz[String(quizId)];

        res.json({
            ...quiz,
            mapping: mapping ? {
                tipe: mapping.tipe,
                total_soal: mapping.total_soal,
                urutan_subtes: mapping.urutan_subtes || null,
                subtes: Object.entries(mapping.subtes).map(([kode, data]) => ({
                    kode,
                    label: data.label,
                    jumlah_soal: data.total || (data.noSoal_end - data.noSoal_start + 1)
                }))
            } : null
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;