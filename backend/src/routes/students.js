const express = require('express');
const router = express.Router();
const { getSiswa, getRiwayatSiswa } = require('../services/moodleService');
const { getRiwayatFromDB } = require('../services/dbService');

// GET /api/students
// List semua siswa
router.get('/', async (req, res, next) => {
    try {
        const siswa = await getSiswa();
        res.json({
            total: siswa.length,
            data: siswa
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/students/:id
// Detail satu siswa
router.get('/:id', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        const siswa = await getSiswa();
        const student = siswa.find(s => s.id === userId);

        if (!student) {
            return res.status(404).json({ error: 'Siswa tidak ditemukan' });
        }

        res.json(student);
    } catch (err) {
        next(err);
    }
});

// GET /api/students/:id/history
// Riwayat semua tryout siswa (dari DB dulu, fallback ke Moodle)
router.get('/:id/history', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);

        // Coba dari DB dulu (lebih cepat)
        let riwayat = await getRiwayatFromDB(userId);

        // Jika DB kosong, ambil dari Moodle
        if (!riwayat || riwayat.length === 0) {
            riwayat = await getRiwayatSiswa(userId);
        }

        res.json({
            user_id: userId,
            total: riwayat.length,
            data: riwayat
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;