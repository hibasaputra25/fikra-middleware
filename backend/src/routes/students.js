const express = require('express');
const router = express.Router();
const { getSiswa, getRiwayatSiswa } = require('../services/moodleService');
const { getRiwayatFromDB } = require('../services/dbService');
const { panggilAPI } = require('../config/moodle');
const { setKurikulumGuru, getKurikulumByGuru } = require('../services/categoryService');

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

// GET /api/students/guru — list semua guru (role editingteacher/teacher)
router.get('/guru/list', async (req, res, next) => {
    try {
        const courseId = process.env.MOODLE_COURSE_ID || 2;
        const data = await panggilAPI('core_enrol_get_enrolled_users', { courseid: courseId });
        const guru = (data || []).filter(u =>
            u.roles && u.roles.some(r =>
                ['editingteacher', 'teacher', 'manager'].includes(r.shortname)
            )
        ).map(u => ({
            id: u.id,
            username: u.username,
            nama: u.fullname,
            email: u.email,
            last_access: u.lastaccess ? new Date(u.lastaccess * 1000).toISOString() : null
        }));
        res.json({ data: guru, total: guru.length });
    } catch (err) { next(err); }
});

// GET /api/students/guru/:userId/kurikulum — kurikulum yang ditugaskan ke guru
router.get('/guru/:userId/kurikulum', async (req, res, next) => {
    try {
        const data = await getKurikulumByGuru(parseInt(req.params.userId));
        res.json({ data });
    } catch (err) { next(err); }
});

// PUT /api/students/guru/:userId/kurikulum — set kurikulum untuk guru (admin)
router.put('/guru/:userId/kurikulum', async (req, res, next) => {
    try {
        const { kurikulum_ids } = req.body;
        await setKurikulumGuru(parseInt(req.params.userId), kurikulum_ids || []);
        const data = await getKurikulumByGuru(parseInt(req.params.userId));
        res.json({ data });
    } catch (err) { next(err); }
});

module.exports = router;