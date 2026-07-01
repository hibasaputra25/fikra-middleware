const express = require('express');
const router  = express.Router();
const XLSX    = require('xlsx');
const { pool } = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { getRekapAbsensi } = require('../services/sesiService');

// =====================================================================
// Helper: kirim file Excel sebagai download
// =====================================================================
function sendXlsx(res, workbook, filename) {
    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}.xlsx"`);
    res.send(buf);
}

function slugDate(d = new Date()) {
    return d.toISOString().slice(0, 10);
}

// =====================================================================
// GET /api/export/tryout/:id/nilai
// Export nilai semua siswa untuk satu tryout → Excel
// Guru: hanya tryout miliknya. Admin: semua.
// =====================================================================
router.get('/tryout/:id/nilai', authMiddleware, requireRole('guru', 'admin'), async (req, res, next) => {
    try {
        const tryoutId = parseInt(req.params.id);
        const { role, id: userId } = req.user;

        // Verifikasi tryout ada (guru bisa export semua tryout, bukan hanya miliknya)
        const [[checkTryout]] = await pool.execute(
            'SELECT id FROM tryouts WHERE id = ? LIMIT 1',
            [tryoutId]
        );
        if (!checkTryout) return res.status(404).json({ error: 'Tryout tidak ditemukan' });

        // Info tryout
        const [[tryout]] = await pool.execute(
            'SELECT id, name, type, created_at FROM tryouts WHERE id = ? LIMIT 1',
            [tryoutId]
        );
        if (!tryout) return res.status(404).json({ error: 'Tryout tidak ditemukan' });

        // Ambil semua attempts yang submitted
        const [attempts] = await pool.execute(`
            SELECT
                ta.id,
                ta.user_id,
                u.nama          AS nama_siswa,
                u.username,
                u.email,
                ta.total_score,
                ta.score_per_section,
                ta.time_spent_seconds,
                ta.finished_at,
                ROW_NUMBER() OVER (ORDER BY ta.total_score DESC, ta.time_spent_seconds ASC) AS ranking
            FROM tryout_attempts ta
            JOIN users u ON u.id = ta.user_id
            WHERE ta.tryout_id = ? AND ta.status = 'submitted'
            ORDER BY ta.total_score DESC, ta.time_spent_seconds ASC
        `, [tryoutId]);

        // Kumpulkan semua nama subtes dari score_per_section
        const subtesSet = new Set();
        attempts.forEach(a => {
            if (a.score_per_section) {
                try {
                    const parsed = typeof a.score_per_section === 'string'
                        ? JSON.parse(a.score_per_section)
                        : a.score_per_section;
                    Object.keys(parsed).forEach(k => subtesSet.add(k));
                } catch { /* skip */ }
            }
        });
        const subtesCols = [...subtesSet];

        // Build rows
        const rows = attempts.map((a, i) => {
            let scorePerSection = {};
            if (a.score_per_section) {
                try {
                    scorePerSection = typeof a.score_per_section === 'string'
                        ? JSON.parse(a.score_per_section)
                        : a.score_per_section;
                } catch { /* skip */ }
            }

            const row = {
                'No':           i + 1,
                'Nama Siswa':   a.nama_siswa,
                'Username':     a.username,
                'Email':        a.email,
                'Total Skor':   a.total_score ?? 0,
            };

            subtesCols.forEach(col => {
                row[col] = scorePerSection[col] ?? '-';
            });

            row['Waktu (menit)'] = a.time_spent_seconds ? Math.round(a.time_spent_seconds / 60) : '-';
            row['Selesai']       = a.finished_at ? new Date(a.finished_at).toLocaleString('id-ID') : '-';

            return row;
        });

        if (rows.length === 0) {
            rows.push({ 'No': '-', 'Nama Siswa': 'Belum ada peserta yang submit', 'Username': '', 'Email': '', 'Total Skor': '' });
        }

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Nilai');

        // Header info di baris awal (prepend 3 baris)
        XLSX.utils.sheet_add_aoa(ws, [
            [`Rekap Nilai Tryout: ${tryout.name}`],
            [`Tanggal Export: ${new Date().toLocaleString('id-ID')}`],
            [`Total Peserta: ${attempts.length}`],
            [],
        ], { origin: 'A1' });

        // Geser data ke bawah header
        const dataRows = [
            ['No', 'Nama Siswa', 'Username', 'Email', 'Total Skor', ...subtesCols, 'Waktu (menit)', 'Selesai'],
            ...attempts.map((a, i) => {
                let sps = {};
                try { sps = typeof a.score_per_section === 'string' ? JSON.parse(a.score_per_section) : (a.score_per_section || {}); } catch { /* */ }
                return [
                    i + 1, a.nama_siswa, a.username, a.email, a.total_score ?? 0,
                    ...subtesCols.map(c => sps[c] ?? '-'),
                    a.time_spent_seconds ? Math.round(a.time_spent_seconds / 60) : '-',
                    a.finished_at ? new Date(a.finished_at).toLocaleString('id-ID') : '-',
                ];
            }),
        ];

        const ws2 = XLSX.utils.aoa_to_sheet([
            [`Rekap Nilai Tryout: ${tryout.name}`],
            [`Tanggal Export: ${new Date().toLocaleString('id-ID')}`],
            [`Total Peserta: ${attempts.length}`],
            [],
            ...dataRows,
        ]);
        const wb2 = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb2, ws2, 'Nilai');

        const safeName = tryout.name.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
        sendXlsx(res, wb2, `Nilai_${safeName}_${slugDate()}`);
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// GET /api/export/siswa/:id/rapor
// Return JSON rekap lengkap satu siswa — untuk di-render di frontend
// Guru: hanya siswa yang diajarnya. Admin: semua.
// =====================================================================
router.get('/siswa/:id/rapor', authMiddleware, requireRole('guru', 'admin'), async (req, res, next) => {
    try {
        const siswaId = parseInt(req.params.id);
        const { role, id: userId } = req.user;

        // Verifikasi siswa ada
        const [[siswa]] = await pool.execute(
            `SELECT id, nama, username, email, created_at, last_login_at
             FROM users WHERE id = ? AND role = 'siswa' LIMIT 1`,
            [siswaId]
        );
        if (!siswa) return res.status(404).json({ error: 'Siswa tidak ditemukan' });

        // Guru hanya bisa akses siswa yang diajarnya
        if (role === 'guru') {
            const [[rel]] = await pool.execute(
                'SELECT id FROM guru_siswa WHERE guru_id = ? AND siswa_id = ? LIMIT 1',
                [userId, siswaId]
            );
            if (!rel) return res.status(403).json({ error: 'Siswa bukan dalam daftar Anda' });
        }

        // 1. Jenjang
        const [jenjang] = await pool.execute(
            `SELECT uj.kurikulum_id, c.name AS kurikulum_name, c.code AS kurikulum_code
             FROM user_jenjang uj
             JOIN categories c ON c.id = uj.kurikulum_id
             WHERE uj.user_id = ?`,
            [siswaId]
        );

        // 2. Tryout attempts
        const [tryoutAttempts] = await pool.execute(
            `SELECT ta.id, ta.attempt_number, ta.total_score, ta.score_per_section,
                    ta.time_spent_seconds, ta.started_at, ta.finished_at,
                    t.name AS tryout_name, t.type AS tryout_type
             FROM tryout_attempts ta
             JOIN tryouts t ON t.id = ta.tryout_id
             WHERE ta.user_id = ? AND ta.status = 'submitted'
             ORDER BY ta.finished_at DESC`,
            [siswaId]
        );

        const tryoutSummary = {
            total_attempts: tryoutAttempts.length,
            avg_score:  tryoutAttempts.length ? Math.round(tryoutAttempts.reduce((s, a) => s + (a.total_score || 0), 0) / tryoutAttempts.length) : 0,
            best_score:  tryoutAttempts.length ? Math.max(...tryoutAttempts.map(a => a.total_score || 0)) : 0,
            worst_score: tryoutAttempts.length ? Math.min(...tryoutAttempts.map(a => a.total_score || 0)) : 0,
        };

        // 3. Latihan attempts
        const [latihanAttempts] = await pool.execute(
            `SELECT la.id, la.total_score, la.total_correct, la.total_wrong,
                    la.time_spent_seconds, la.finished_at,
                    lp.nama AS paket_nama
             FROM latihan_attempts la
             JOIN latihan_paket lp ON lp.id = la.paket_id
             WHERE la.user_id = ? AND la.status = 'submitted'
             ORDER BY la.finished_at DESC`,
            [siswaId]
        );

        // 4. Absensi
        const [absensiDetail] = await pool.execute(
            `SELECT sa.status, sa.catatan, sk.tanggal, sk.mapel, sk.jenjang
             FROM sesi_absensi sa
             JOIN sesi_kelas sk ON sk.id = sa.sesi_id
             WHERE sa.user_id = ?
             ORDER BY sk.tanggal DESC`,
            [siswaId]
        );

        const absensiSummary = { total_sesi: absensiDetail.length, hadir: 0, izin: 0, sakit: 0, alfa: 0 };
        absensiDetail.forEach(a => {
            if (a.status in absensiSummary) absensiSummary[a.status]++;
        });

        // 5. Catatan guru
        const [catatan] = await pool.execute(
            `SELECT sc.kondisi, sc.fokus, sc.catatan,
                    sk.tanggal, sk.mapel,
                    u.nama AS nama_guru
             FROM sesi_catatan_siswa sc
             JOIN sesi_kelas sk ON sk.id = sc.sesi_id
             JOIN users u ON u.id = sk.guru_id
             WHERE sc.user_id = ?
             ORDER BY sk.tanggal DESC`,
            [siswaId]
        );

        res.json({
            siswa,
            jenjang,
            tryout: {
                summary: tryoutSummary,
                attempts: tryoutAttempts,
            },
            latihan: {
                total: latihanAttempts.length,
                attempts: latihanAttempts,
            },
            absensi: {
                summary: absensiSummary,
                detail:  absensiDetail,
            },
            catatan_guru: catatan,
            generated_at: new Date().toISOString(),
        });
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// GET /api/export/absensi
// Export rekap absensi → Excel
// Query: ?tanggal_dari=&tanggal_sampai=&guru_id=&jenjang=
// Guru: filter guru_id otomatis ke diri sendiri. Admin: semua.
// =====================================================================
router.get('/absensi', authMiddleware, requireRole('guru', 'admin'), async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        let { tanggal_dari, tanggal_sampai, guru_id, jenjang } = req.query;

        // Guru hanya bisa export absensinya sendiri
        if (role === 'guru') guru_id = userId;

        const rows = await getRekapAbsensi({
            guru_id:       guru_id   ? parseInt(guru_id)   : undefined,
            jenjang:       jenjang   || undefined,
            tanggal_dari:  tanggal_dari  || undefined,
            tanggal_sampai: tanggal_sampai || undefined,
        });

        const dataRows = rows.map((r, i) => ({
            'No':           i + 1,
            'Tanggal':      r.tanggal ? new Date(r.tanggal).toLocaleDateString('id-ID') : '-',
            'Guru':         r.nama_guru || '-',
            'Jenjang':      r.jenjang  || '-',
            'Mapel':        r.mapel    || '-',
            'Nama Siswa':   r.nama_siswa || '-',
            'Status':       r.status   || '-',
            'Catatan':      r.catatan  || '',
            'Topik Sesi':   r.topik    || '',
            'Capaian Sesi': r.capaian  || '',
        }));

        if (dataRows.length === 0) {
            dataRows.push({ 'No': '-', 'Tanggal': 'Tidak ada data absensi', 'Guru': '', 'Jenjang': '', 'Mapel': '', 'Nama Siswa': '', 'Status': '', 'Catatan': '', 'Topik Sesi': '', 'Capaian Sesi': '' });
        }

        const header = [
            ['Rekap Absensi Sesi Kelas - Fikra Academy'],
            [`Periode: ${tanggal_dari || 'Semua'} s/d ${tanggal_sampai || 'Semua'}`],
            [`Tanggal Export: ${new Date().toLocaleString('id-ID')}`],
            [`Total Entri: ${rows.length}`],
            [],
        ];

        const ws = XLSX.utils.json_to_sheet(dataRows);
        XLSX.utils.sheet_add_aoa(ws, header, { origin: 'A1' });

        // Rebuild dengan header info + data
        const aoa = [
            ...header,
            Object.keys(dataRows[0] || {}),
            ...dataRows.map(Object.values),
        ];
        const ws2 = XLSX.utils.aoa_to_sheet(aoa);
        const wb  = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws2, 'Absensi');

        const dari  = (tanggal_dari  || slugDate()).replace(/-/g, '');
        const sampai = (tanggal_sampai || slugDate()).replace(/-/g, '');
        sendXlsx(res, wb, `Absensi_${dari}_${sampai}`);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
