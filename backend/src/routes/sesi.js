const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const {
    createSesi,
    updateSesi,
    getSesiByGuru,
    getRekapAbsensi,
    getAllSesi,
    getSesiById,
    deleteSesi,
    saveAbsensi,
    saveReport,
    saveCatatanSiswa,
    submitSesi,
    getStatsByGuru
} = require('../services/sesiService');
const { getSiswa } = require('../services/moodleService');

router.use(authMiddleware);

// ─── GURU ROUTES ──────────────────────────────────────────────────────────────

// GET /api/sesi — list sesi milik guru yang login
router.get('/', async (req, res, next) => {
    try {
        const sesi = await getSesiByGuru(req.user.id);
        res.json({ data: sesi, total: sesi.length });
    } catch (err) { next(err); }
});

// GET /api/sesi/siswa — ambil daftar siswa dari Moodle (untuk absensi)
router.get('/siswa', async (req, res, next) => {
    try {
        const siswa = await getSiswa();
        res.json({ data: siswa });
    } catch (err) { next(err); }
});

// POST /api/sesi — buat sesi baru
router.post('/', async (req, res, next) => {
    try {
        const { tanggal, jenjang, mapel, durasi_menit } = req.body;
        if (!tanggal || !jenjang || !mapel) {
            return res.status(400).json({ error: 'tanggal, jenjang, dan mapel wajib diisi' });
        }
        const id = await createSesi({
            guru_id: req.user.id,
            guru_nama: req.user.nama,
            tanggal,
            jenjang,
            mapel,
            durasi_menit: durasi_menit || 60
        });
        const sesi = await getSesiById(id);
        res.status(201).json(sesi);
    } catch (err) { next(err); }
});

// GET /api/sesi/:id — detail sesi
router.get('/:id', async (req, res, next) => {
    try {
        const sesi = await getSesiById(parseInt(req.params.id));
        if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan' });

        // Guru hanya bisa lihat sesi mereka sendiri
        if (req.user.role !== 'admin' && sesi.guru_id !== req.user.id) {
            return res.status(403).json({ error: 'Tidak diizinkan' });
        }
        res.json(sesi);
    } catch (err) { next(err); }
});

// PUT /api/sesi/:id — edit sesi
router.put('/:id', async (req, res, next) => {
    try {
        const sesiId = parseInt(req.params.id);
        const sesi = await getSesiById(sesiId);
        if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
        if (sesi.guru_id !== req.user.id) return res.status(403).json({ error: 'Tidak diizinkan' });

        const { tanggal, jenjang, mapel, durasi_menit } = req.body;
        await updateSesi(sesiId, { tanggal, jenjang, mapel, durasi_menit });
        const updated = await getSesiById(sesiId);
        res.json(updated);
    } catch (err) { next(err); }
});

// DELETE /api/sesi/:id — hapus sesi
router.delete('/:id', async (req, res, next) => {
    try {
        const sesi = await getSesiById(parseInt(req.params.id));
        if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
        if (sesi.guru_id !== req.user.id) return res.status(403).json({ error: 'Tidak diizinkan' });
        await deleteSesi(parseInt(req.params.id));
        res.json({ success: true });
    } catch (err) { next(err); }
});

// PUT /api/sesi/:id/absensi — simpan absensi
router.put('/:id/absensi', async (req, res, next) => {
    try {
        const sesiId = parseInt(req.params.id);
        const sesi = await getSesiById(sesiId);
        if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
        if (sesi.guru_id !== req.user.id) return res.status(403).json({ error: 'Tidak diizinkan' });

        const { absensi } = req.body;
        if (!Array.isArray(absensi)) return res.status(400).json({ error: 'absensi harus berupa array' });

        await saveAbsensi(sesiId, absensi);
        res.json({ success: true });
    } catch (err) { next(err); }
});

// PUT /api/sesi/:id/report — simpan report
router.put('/:id/report', async (req, res, next) => {
    try {
        const sesiId = parseInt(req.params.id);
        const sesi = await getSesiById(sesiId);
        if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
        if (sesi.guru_id !== req.user.id) return res.status(403).json({ error: 'Tidak diizinkan' });

        if (!req.body.topik) return res.status(400).json({ error: 'topik wajib diisi' });

        await saveReport(sesiId, req.body);
        res.json({ success: true });
    } catch (err) { next(err); }
});

// PUT /api/sesi/:id/catatan-siswa — simpan catatan per siswa
router.put('/:id/catatan-siswa', async (req, res, next) => {
    try {
        const sesiId = parseInt(req.params.id);
        const sesi = await getSesiById(sesiId);
        if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
        if (sesi.guru_id !== req.user.id) return res.status(403).json({ error: 'Tidak diizinkan' });

        const { catatan_siswa } = req.body;
        if (!Array.isArray(catatan_siswa)) return res.status(400).json({ error: 'catatan_siswa harus berupa array' });

        await saveCatatanSiswa(sesiId, catatan_siswa);
        res.json({ success: true });
    } catch (err) { next(err); }
});

// POST /api/sesi/:id/submit — submit sesi lengkap sekaligus
router.post('/:id/submit', async (req, res, next) => {
    try {
        const sesiId = parseInt(req.params.id);
        const sesi = await getSesiById(sesiId);
        if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
        if (sesi.guru_id !== req.user.id) return res.status(403).json({ error: 'Tidak diizinkan' });

        const { absensi, report, catatan_siswa } = req.body;
        if (!report?.topik) return res.status(400).json({ error: 'Topik materi wajib diisi' });

        await submitSesi(sesiId, { absensi, report, catatan_siswa });
        const result = await getSesiById(sesiId);
        res.json(result);
    } catch (err) { next(err); }
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

// GET /api/sesi/admin/all — semua sesi (admin only)
router.get('/admin/all', async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        const { guru_id, jenjang, tanggal_dari, tanggal_sampai, limit, offset } = req.query;
        const sesi = await getAllSesi({
            guru_id: guru_id ? parseInt(guru_id) : undefined,
            jenjang,
            tanggal_dari,
            tanggal_sampai,
            limit: limit ? parseInt(limit) : 50,
            offset: offset ? parseInt(offset) : 0
        });
        res.json({ data: sesi, total: sesi.length });
    } catch (err) { next(err); }
});

// GET /api/sesi/admin/absensi — rekap absensi semua sesi (admin only)
router.get('/admin/absensi', async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        const { guru_id, jenjang, tanggal_dari, tanggal_sampai } = req.query;
        const rows = await getRekapAbsensi({
            guru_id: guru_id ? parseInt(guru_id) : undefined,
            jenjang,
            tanggal_dari,
            tanggal_sampai
        });
        res.json({ data: rows, total: rows.length });
    } catch (err) { next(err); }
});

// GET /api/sesi/admin/stats — statistik per guru (admin only)
router.get('/admin/stats', async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        const stats = await getStatsByGuru();
        res.json({ data: stats });
    } catch (err) { next(err); }
});

// GET /api/sesi/admin/guru/:guruId — semua sesi milik guru (admin only)
router.get('/admin/guru/:guruId', async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        const guruId = parseInt(req.params.guruId);
        const sesi = await getAllSesi({ guru_id: guruId, limit: 200 });
        res.json({ data: sesi, total: sesi.length });
    } catch (err) { next(err); }
});

// GET /api/sesi/admin/detail/:sesiId — detail lengkap satu sesi (admin only)
router.get('/admin/detail/:sesiId', async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        const sesi = await getSesiById(parseInt(req.params.sesiId));
        if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
        res.json(sesi);
    } catch (err) { next(err); }
});

module.exports = router;
