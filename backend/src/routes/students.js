const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { getRiwayatFromDB } = require('../services/dbService');
const { setKurikulumGuru, getKurikulumByGuru } = require('../services/categoryService');

// GET /api/students
// List semua siswa — hanya admin & guru
router.get('/', authMiddleware, requireRole('admin', 'guru'), async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, username, nama, email, role, is_active, created_at
             FROM users
             WHERE role = 'siswa'
             ORDER BY created_at DESC`
        );
        res.json({ total: rows.length, data: rows });
    } catch (err) {
        next(err);
    }
});

// GET /api/students/guru/list
// List semua guru — hanya admin
// HARUS sebelum /:id agar tidak di-intercept
router.get('/guru/list', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, username, nama, email, role, created_at
             FROM users
             WHERE role IN ('guru', 'admin')
             ORDER BY nama ASC`
        );
        res.json({ data: rows, total: rows.length });
    } catch (err) {
        next(err);
    }
});

// GET /api/students/guru/:userId/kurikulum
// Kurikulum yang ditugaskan ke guru
router.get('/guru/:userId/kurikulum', authMiddleware, requireRole('admin', 'guru'), async (req, res, next) => {
    try {
        const data = await getKurikulumByGuru(parseInt(req.params.userId));
        res.json({ data });
    } catch (err) {
        next(err);
    }
});

// PUT /api/students/guru/:userId/kurikulum
// Set kurikulum untuk guru — hanya admin
router.put('/guru/:userId/kurikulum', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
        const { kurikulum_ids } = req.body;
        await setKurikulumGuru(parseInt(req.params.userId), kurikulum_ids || []);
        const data = await getKurikulumByGuru(parseInt(req.params.userId));
        res.json({ data });
    } catch (err) {
        next(err);
    }
});

// GET /api/students/guru/:userId/siswa
// List siswa yang diajar oleh guru tertentu
router.get('/guru/:userId/siswa', authMiddleware, requireRole('admin', 'guru'), async (req, res, next) => {
    try {
        const guruId = parseInt(req.params.userId);
        if (isNaN(guruId)) return res.status(400).json({ error: 'ID tidak valid' });

        const [rows] = await pool.execute(
            `SELECT u.id, u.username, u.nama, u.email, u.last_login_at
             FROM users u
             JOIN guru_siswa gs ON gs.siswa_id = u.id
             WHERE gs.guru_id = ? AND u.role = 'siswa' AND u.is_active = 1
             ORDER BY u.nama ASC`,
            [guruId]
        );
        res.json({ total: rows.length, data: rows });
    } catch (err) {
        next(err);
    }
});

// PUT /api/students/guru/:userId/siswa
// Set daftar siswa untuk guru (replace all) — hanya admin
router.put('/guru/:userId/siswa', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
        const guruId = parseInt(req.params.userId);
        if (isNaN(guruId)) return res.status(400).json({ error: 'ID tidak valid' });

        const { siswa_ids = [] } = req.body;
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.execute('DELETE FROM guru_siswa WHERE guru_id = ?', [guruId]);
            if (siswa_ids.length > 0) {
                const values = siswa_ids.map(id => [guruId, id]);
                await conn.query('INSERT INTO guru_siswa (guru_id, siswa_id) VALUES ?', [values]);
            }
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

        const [rows] = await pool.execute(
            `SELECT u.id, u.username, u.nama, u.email
             FROM users u
             JOIN guru_siswa gs ON gs.siswa_id = u.id
             WHERE gs.guru_id = ? AND u.role = 'siswa'
             ORDER BY u.nama ASC`,
            [guruId]
        );
        res.json({ total: rows.length, data: rows });
    } catch (err) {
        next(err);
    }
});


// Riwayat tryout siswa dari DB lokal
// HARUS sebelum /:id
router.get('/:id/history', authMiddleware, async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) return res.status(400).json({ error: 'ID tidak valid' });

        const { role, id: requesterId } = req.user;

        // Siswa hanya boleh lihat riwayatnya sendiri
        if (role === 'siswa') {
            if (requesterId !== userId) {
                return res.status(403).json({ error: 'Akses ditolak' });
            }
        }

        // Guru hanya boleh lihat history siswa yang diajarnya
        if (role === 'guru') {
            const [[rel]] = await pool.execute(
                'SELECT id FROM guru_siswa WHERE guru_id = ? AND siswa_id = ? LIMIT 1',
                [requesterId, userId]
            );
            if (!rel) {
                return res.status(403).json({ error: 'Siswa bukan dalam daftar Anda' });
            }
        }

        // Admin bisa lihat semua

        const riwayat = await getRiwayatFromDB(userId);
        res.json({ user_id: userId, total: riwayat.length, data: riwayat });
    } catch (err) {
        next(err);
    }
});

// GET /api/students/:id/progress
// Rekap lengkap progress satu siswa — untuk guru & admin
// HARUS sebelum /:id
router.get('/:id/progress', authMiddleware, requireRole('admin', 'guru'), async (req, res, next) => {
    try {
        const siswaId = parseInt(req.params.id);
        if (isNaN(siswaId)) return res.status(400).json({ error: 'ID tidak valid' });

        // 1. Info dasar siswa
        const [[siswa]] = await pool.execute(
            `SELECT id, username, nama, email, role, is_active, last_login_at, created_at
             FROM users WHERE id = ? AND role = 'siswa' LIMIT 1`,
            [siswaId]
        );
        if (!siswa) return res.status(404).json({ error: 'Siswa tidak ditemukan' });

        // 2. Jenjang (kurikulum) siswa
        const [jenjang] = await pool.execute(
            `SELECT uj.kurikulum_id, c.name AS kurikulum_name, c.code AS kurikulum_code
             FROM user_jenjang uj
             JOIN categories c ON c.id = uj.kurikulum_id
             WHERE uj.user_id = ?`,
            [siswaId]
        );

        // 3. Riwayat tryout attempts (submitted saja)
        const [tryoutAttempts] = await pool.execute(
            `SELECT ta.id, ta.attempt_number, ta.total_score, ta.time_spent_seconds,
                    ta.started_at, ta.finished_at, ta.score_per_section,
                    t.name AS tryout_name, t.type AS tryout_type
             FROM tryout_attempts ta
             JOIN tryouts t ON t.id = ta.tryout_id
             WHERE ta.user_id = ? AND ta.status = 'submitted'
             ORDER BY ta.finished_at DESC
             LIMIT 50`,
            [siswaId]
        );

        // Parse score_per_section JSON
        const attemptsFormatted = tryoutAttempts.map(a => ({
            ...a,
            score_per_section: typeof a.score_per_section === 'string'
                ? JSON.parse(a.score_per_section) : (a.score_per_section || {})
        }));

        // 4. Summary tryout
        const [[tryoutSummary]] = await pool.execute(
            `SELECT
                COUNT(*) AS total_attempts,
                ROUND(AVG(total_score), 1) AS avg_score,
                MAX(total_score) AS best_score,
                MIN(total_score) AS worst_score
             FROM tryout_attempts
             WHERE user_id = ? AND status = 'submitted'`,
            [siswaId]
        );

        // 5. Tren skor per tryout (untuk chart — max 20 terakhir, urut ASC)
        const [trenSkor] = await pool.execute(
            `SELECT ta.finished_at, ta.total_score, t.name AS tryout_name
             FROM tryout_attempts ta
             JOIN tryouts t ON t.id = ta.tryout_id
             WHERE ta.user_id = ? AND ta.status = 'submitted'
             ORDER BY ta.finished_at DESC LIMIT 20`,
            [siswaId]
        );
        trenSkor.reverse(); // Tampilkan ASC untuk chart

        // 6. Rekap absensi
        const [[absensiSummary]] = await pool.execute(
            `SELECT
                COUNT(*) AS total_sesi,
                SUM(CASE WHEN status = 'hadir' THEN 1 ELSE 0 END) AS hadir,
                SUM(CASE WHEN status = 'izin'  THEN 1 ELSE 0 END) AS izin,
                SUM(CASE WHEN status = 'sakit' THEN 1 ELSE 0 END) AS sakit,
                SUM(CASE WHEN status = 'alfa'  THEN 1 ELSE 0 END) AS alfa
             FROM sesi_absensi
             WHERE user_id = ?`,
            [siswaId]
        );

        // 7. Riwayat absensi detail (20 terbaru)
        const [absensiDetail] = await pool.execute(
            `SELECT sa.status, sa.catatan,
                    sk.tanggal, sk.mapel, sk.jenjang
             FROM sesi_absensi sa
             JOIN sesi_kelas sk ON sk.id = sa.sesi_id
             WHERE sa.user_id = ?
             ORDER BY sk.tanggal DESC LIMIT 20`,
            [siswaId]
        );

        // 8. Catatan guru terbaru (20 terbaru)
        const [catatan] = await pool.execute(
            `SELECT scs.kondisi, scs.fokus, scs.catatan,
                    sk.tanggal, sk.mapel, sk.jenjang,
                    sk.guru_nama AS nama_guru
             FROM sesi_catatan_siswa scs
             JOIN sesi_kelas sk ON sk.id = scs.sesi_id
             WHERE scs.user_id = ?
             ORDER BY sk.tanggal DESC LIMIT 20`,
            [siswaId]
        );

        // 9. Riwayat latihan (submitted, 20 terbaru)
        const [latihanAttempts] = await pool.execute(
            `SELECT la.id, la.total_score, la.total_correct, la.total_wrong,
                    la.finished_at, la.time_spent_seconds,
                    lp.name AS paket_nama
             FROM latihan_attempts la
             JOIN latihan_paket lp ON lp.id = la.paket_id
             WHERE la.user_id = ? AND la.status = 'submitted'
             ORDER BY la.finished_at DESC LIMIT 20`,
            [siswaId]
        );

        res.json({
            siswa,
            jenjang,
            tryout: {
                summary: tryoutSummary,
                tren: trenSkor,
                attempts: attemptsFormatted,
            },
            latihan: {
                attempts: latihanAttempts,
            },
            absensi: {
                summary: absensiSummary,
                detail: absensiDetail,
            },
            catatan,
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/students/:id/jenjang — ambil kurikulum terdaftar siswa
// Admin & guru bisa lihat jenjang siswa manapun
router.get('/:id/jenjang', authMiddleware, requireRole('admin', 'guru'), async (req, res, next) => {
    try {
        const siswaId = parseInt(req.params.id);
        if (isNaN(siswaId)) return res.status(400).json({ error: 'ID tidak valid' });

        const [data] = await pool.execute(
            `SELECT uj.id, uj.kurikulum_id, c.name AS kurikulum_name, c.code AS kurikulum_code
             FROM user_jenjang uj
             JOIN categories c ON c.id = uj.kurikulum_id
             WHERE uj.user_id = ?
             ORDER BY c.sort_order`,
            [siswaId]
        );
        res.json({ data });
    } catch (err) {
        next(err);
    }
});

// PUT /api/students/:id/jenjang — set kurikulum siswa (replace semua)
// Hanya admin
router.put('/:id/jenjang', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
        const siswaId = parseInt(req.params.id);
        if (isNaN(siswaId)) return res.status(400).json({ error: 'ID tidak valid' });

        const { kurikulum_ids } = req.body;
        if (!Array.isArray(kurikulum_ids)) {
            return res.status(400).json({ error: 'kurikulum_ids harus berupa array' });
        }

        // Verifikasi siswa ada
        const [[siswa]] = await pool.execute(
            "SELECT id FROM users WHERE id = ? AND role = 'siswa' LIMIT 1",
            [siswaId]
        );
        if (!siswa) return res.status(404).json({ error: 'Siswa tidak ditemukan' });

        // Replace: hapus semua lalu insert baru
        await pool.execute('DELETE FROM user_jenjang WHERE user_id = ?', [siswaId]);

        if (kurikulum_ids.length > 0) {
            const placeholders = kurikulum_ids.map(() => '(?, ?)').join(', ');
            const values = kurikulum_ids.flatMap(id => [siswaId, parseInt(id)]);
            await pool.execute(
                `INSERT IGNORE INTO user_jenjang (user_id, kurikulum_id) VALUES ${placeholders}`,
                values
            );
        }

        // Return data terbaru
        const [data] = await pool.execute(
            `SELECT uj.id, uj.kurikulum_id, c.name AS kurikulum_name, c.code AS kurikulum_code
             FROM user_jenjang uj
             JOIN categories c ON c.id = uj.kurikulum_id
             WHERE uj.user_id = ?
             ORDER BY c.sort_order`,
            [siswaId]
        );
        res.json({ data });
    } catch (err) {
        next(err);
    }
});

// GET /api/students/:id
// Detail satu siswa — admin, guru, atau siswa itu sendiri
router.get('/:id', authMiddleware, async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) return res.status(400).json({ error: 'ID tidak valid' });

        // Siswa hanya boleh lihat datanya sendiri
        if (req.user.role === 'siswa' && req.user.id !== userId) {
            return res.status(403).json({ error: 'Akses ditolak' });
        }

        const [[student]] = await pool.execute(
            `SELECT id, username, nama, email, role, is_active, created_at
             FROM users WHERE id = ? LIMIT 1`,
            [userId]
        );

        if (!student) return res.status(404).json({ error: 'Siswa tidak ditemukan' });

        res.json(student);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
