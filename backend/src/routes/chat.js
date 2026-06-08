const express = require('express');
const router = express.Router();
const { chat } = require('../services/aiService');
const { getHasilFromDB } = require('../services/dbService');
const { getHasilSiswa, getQuizzes } = require('../services/moodleService');

// POST /api/chat
// Chat dengan Kak Fikra AI
// Body: { userId, quizId, messages: [{role, content}] }
router.post('/', async (req, res, next) => {
    try {
        const { userId, quizId, messages } = req.body;

        if (!userId || !messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                error: 'userId dan messages wajib diisi'
            });
        }

        // Validasi format messages
        const validMessages = messages.filter(m =>
            m.role && m.content &&
            ['user', 'assistant'].includes(m.role)
        );

        if (validMessages.length === 0) {
            return res.status(400).json({ error: 'Format messages tidak valid' });
        }

        // Ambil data performa siswa
        let nilaiPerSubtes = {};
        let namaSiswa = `Siswa ${userId}`;

        if (quizId) {
            // Coba dari DB dulu
            let hasil = await getHasilFromDB(userId, quizId);

            // Fallback ke Moodle
            if (!hasil) {
                try {
                    const moodleHasil = await getHasilSiswa(userId, quizId);
                    if (moodleHasil) {
                        nilaiPerSubtes = moodleHasil.per_subtes;
                        namaSiswa = `Siswa ${userId}`;
                    }
                } catch (e) {
                    console.warn('⚠️ Gagal ambil data Moodle untuk chat:', e.message);
                }
            } else {
                nilaiPerSubtes = hasil.skor_subtes?.per_subtes || {};
                namaSiswa = hasil.nama_siswa;
            }
        }

        // Panggil AI
        const reply = await chat(validMessages, namaSiswa, nilaiPerSubtes);

        res.json({
            role: 'assistant',
            content: reply
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