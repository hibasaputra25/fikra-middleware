const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const {
    listMateri,
    listMateriManage,
    getMateriById,
    createMateri,
    updateMateri,
    deleteMateri,
} = require('../services/materiService');

// =====================================================================
// GET /api/materi
// Siswa: hanya materi sesuai jenjang terdaftar (user_jenjang)
// Guru/Admin: semua materi aktif
// Query: ?kurikulum_id=&subtes_id=&jenis=
// =====================================================================
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const { kurikulum_id, subtes_id, jenis } = req.query;

        const data = await listMateri({ role, userId, kurikulum_id, subtes_id, jenis });
        res.json({ total: data.length, data });
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// GET /api/materi/manage — HARUS sebelum /:id
// Guru: lihat materi yang dia buat
// Admin: lihat semua materi (termasuk non-aktif)
// =====================================================================
router.get('/manage', authMiddleware, requireRole('guru', 'admin'), async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const { kurikulum_id, subtes_id } = req.query;

        const data = await listMateriManage({ role, userId, kurikulum_id, subtes_id });
        res.json({ total: data.length, data });
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// GET /api/materi/:id
// =====================================================================
router.get('/:id', authMiddleware, async (req, res, next) => {
    try {
        const materi = await getMateriById(parseInt(req.params.id));
        if (!materi) return res.status(404).json({ error: 'Materi tidak ditemukan' });

        // Siswa hanya bisa akses materi aktif
        if (req.user.role === 'siswa' && !materi.is_active) {
            return res.status(404).json({ error: 'Materi tidak ditemukan' });
        }

        res.json(materi);
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// POST /api/materi — buat materi baru
// =====================================================================
router.post('/', authMiddleware, requireRole('guru', 'admin'), async (req, res, next) => {
    try {
        const materi = await createMateri(req.body, req.user.id);
        res.status(201).json(materi);
    } catch (err) {
        if (err.message.includes('wajib') || err.message.includes('belum')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
});

// =====================================================================
// PUT /api/materi/:id — update materi (ownership check di service)
// =====================================================================
router.put('/:id', authMiddleware, requireRole('guru', 'admin'), async (req, res, next) => {
    try {
        const materi = await updateMateri(
            parseInt(req.params.id),
            req.body,
            { role: req.user.role, userId: req.user.id }
        );
        res.json(materi);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        if (err.message.includes('wajib')) return res.status(400).json({ error: err.message });
        next(err);
    }
});

// =====================================================================
// DELETE /api/materi/:id — soft delete (ownership check di service)
// =====================================================================
router.delete('/:id', authMiddleware, requireRole('guru', 'admin'), async (req, res, next) => {
    try {
        const result = await deleteMateri(
            parseInt(req.params.id),
            { role: req.user.role, userId: req.user.id }
        );
        res.json(result);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        next(err);
    }
});

module.exports = router;
