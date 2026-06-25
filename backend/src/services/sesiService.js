const { pool } = require('../config/db');

// =====================================================================
// SESI KELAS
// =====================================================================

async function createSesi(data) {
    // mapel bisa array atau string, simpan sebagai JSON string
    const mapelStr = Array.isArray(data.mapel)
        ? JSON.stringify(data.mapel)
        : data.mapel;
    const tanggalStr = data.tanggal.includes('T') ? data.tanggal.split('T')[0] : data.tanggal;
    const [result] = await pool.execute(
        `INSERT INTO sesi_kelas (guru_id, guru_nama, tanggal, jenjang, mapel, durasi_menit, status)
         VALUES (?, ?, ?, ?, ?, ?, 'draft')`,
        [data.guru_id, data.guru_nama, tanggalStr, data.jenjang, mapelStr, data.durasi_menit || 60]
    );
    return result.insertId;
}

async function updateSesi(sesiId, data) {
    const fields = [];
    const params = [];

    if (data.tanggal !== undefined) {
        // Normalize: ambil hanya bagian tanggal (YYYY-MM-DD)
        const tanggalStr = data.tanggal.includes('T')
            ? data.tanggal.split('T')[0]
            : data.tanggal;
        fields.push('tanggal = ?');
        params.push(tanggalStr);
    }
    if (data.jenjang !== undefined) { fields.push('jenjang = ?'); params.push(data.jenjang); }
    if (data.mapel !== undefined) {
        fields.push('mapel = ?');
        params.push(Array.isArray(data.mapel) ? JSON.stringify(data.mapel) : data.mapel);
    }
    if (data.durasi_menit !== undefined) { fields.push('durasi_menit = ?'); params.push(data.durasi_menit); }
    if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status); }

    if (fields.length === 0) return;
    params.push(sesiId);
    await pool.execute(`UPDATE sesi_kelas SET ${fields.join(', ')} WHERE id = ?`, params);
}

async function getSesiByGuru(guruId, { limit = 20, offset = 0 } = {}) {
    const [rows] = await pool.execute(
        `SELECT
            sk.*,
            COUNT(DISTINCT sa.id) AS jumlah_hadir,
            sr.id AS report_id,
            sr.topik,
            sr.capaian
         FROM sesi_kelas sk
         LEFT JOIN sesi_absensi sa ON sa.sesi_id = sk.id AND sa.status = 'hadir'
         LEFT JOIN sesi_report sr ON sr.sesi_id = sk.id
         WHERE sk.guru_id = ?
         GROUP BY sk.id
         ORDER BY sk.tanggal DESC, sk.created_at DESC
         LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
        [guruId]
    );
    return rows;
}

async function getAllSesi({ limit = 50, offset = 0, guru_id, jenjang, tanggal_dari, tanggal_sampai } = {}) {
    const conditions = [];
    const params = [];

    if (guru_id) { conditions.push('sk.guru_id = ?'); params.push(guru_id); }
    if (jenjang) { conditions.push('sk.jenjang = ?'); params.push(jenjang); }
    if (tanggal_dari) { conditions.push('sk.tanggal >= ?'); params.push(tanggal_dari); }
    if (tanggal_sampai) { conditions.push('sk.tanggal <= ?'); params.push(tanggal_sampai); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.execute(
        `SELECT
            sk.*,
            COUNT(DISTINCT sa.id) AS jumlah_hadir,
            sr.id AS report_id,
            sr.topik,
            sr.capaian
         FROM sesi_kelas sk
         LEFT JOIN sesi_absensi sa ON sa.sesi_id = sk.id AND sa.status = 'hadir'
         LEFT JOIN sesi_report sr ON sr.sesi_id = sk.id
         ${where}
         GROUP BY sk.id
         ORDER BY sk.tanggal DESC, sk.created_at DESC
         LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
        params
    );
    return rows;
}

async function getSesiById(sesiId) {
    const [[sesi]] = await pool.execute(
        `SELECT sk.* FROM sesi_kelas sk WHERE sk.id = ?`,
        [sesiId]
    );
    if (!sesi) return null;

    // Absensi
    const [absensi] = await pool.execute(
        'SELECT * FROM sesi_absensi WHERE sesi_id = ? ORDER BY nama_siswa ASC',
        [sesiId]
    );

    // Report
    const [[report]] = await pool.execute(
        'SELECT * FROM sesi_report WHERE sesi_id = ?',
        [sesiId]
    );

    // Catatan siswa
    const [catatanSiswa] = await pool.execute(
        'SELECT * FROM sesi_catatan_siswa WHERE sesi_id = ? ORDER BY nama_siswa ASC',
        [sesiId]
    );

    if (report && report.kendala) {
        report.kendala = typeof report.kendala === 'string'
            ? JSON.parse(report.kendala)
            : report.kendala;
    }

    return {
        ...sesi,
        absensi,
        report: report || null,
        catatan_siswa: catatanSiswa
    };
}

async function updateSesiStatus(sesiId, status) {
    await pool.execute(
        'UPDATE sesi_kelas SET status = ? WHERE id = ?',
        [status, sesiId]
    );
}

async function deleteSesi(sesiId) {
    await pool.execute('DELETE FROM sesi_kelas WHERE id = ?', [sesiId]);
}

// =====================================================================
// ABSENSI
// =====================================================================

async function saveAbsensi(sesiId, absensiList) {
    // Replace all: hapus dulu, insert ulang
    await pool.execute('DELETE FROM sesi_absensi WHERE sesi_id = ?', [sesiId]);

    if (!absensiList || absensiList.length === 0) return;

    // Resolve nama_siswa dari users jika user_id ada tapi nama_siswa kosong
    const resolvedList = await Promise.all(absensiList.map(async a => {
        let namaSiswa = a.nama_siswa || null;
        if (!namaSiswa && a.user_id) {
            try {
                const [[user]] = await pool.execute(
                    'SELECT nama FROM users WHERE id = ? LIMIT 1',
                    [a.user_id]
                );
                if (user) namaSiswa = user.nama;
            } catch { /* pakai null */ }
        }
        return {
            user_id:    a.user_id    || null,
            nama_siswa: namaSiswa    || `Siswa #${a.user_id || '?'}`,
            status:     a.status    || 'hadir',
            catatan:    a.catatan   || null,
        };
    }));

    const values = resolvedList.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const params = resolvedList.flatMap(a => [
        sesiId,
        a.user_id,
        a.nama_siswa,
        a.status,
        a.catatan
    ]);

    await pool.execute(
        `INSERT INTO sesi_absensi (sesi_id, user_id, nama_siswa, status, catatan) VALUES ${values}`,
        params
    );
}

// =====================================================================
// REPORT
// =====================================================================

async function saveReport(sesiId, data) {
    const existing = await pool.execute(
        'SELECT id FROM sesi_report WHERE sesi_id = ?',
        [sesiId]
    );

    const kendalaJson = data.kendala ? JSON.stringify(data.kendala) : null;

    if (existing[0].length > 0) {
        await pool.execute(
            `UPDATE sesi_report SET
                topik = ?, target_pembelajaran = ?, capaian = ?,
                catatan_materi = ?, kondisi_kelas = ?, fokus_siswa = ?,
                kendala = ?, catatan_umum = ?
             WHERE sesi_id = ?`,
            [
                data.topik,
                data.target_pembelajaran || null,
                data.capaian || 'tercapai',
                data.catatan_materi || null,
                data.kondisi_kelas || 'kondusif',
                data.fokus_siswa || 3,
                kendalaJson,
                data.catatan_umum || null,
                sesiId
            ]
        );
    } else {
        await pool.execute(
            `INSERT INTO sesi_report
                (sesi_id, topik, target_pembelajaran, capaian, catatan_materi,
                 kondisi_kelas, fokus_siswa, kendala, catatan_umum)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                sesiId,
                data.topik,
                data.target_pembelajaran || null,
                data.capaian || 'tercapai',
                data.catatan_materi || null,
                data.kondisi_kelas || 'kondusif',
                data.fokus_siswa || 3,
                kendalaJson,
                data.catatan_umum || null
            ]
        );
    }
}

// =====================================================================
// CATATAN SISWA
// =====================================================================

async function saveCatatanSiswa(sesiId, catatanList) {
    if (!catatanList || catatanList.length === 0) return;

    for (const c of catatanList) {
        await pool.execute(
            `INSERT INTO sesi_catatan_siswa
                (sesi_id, user_id, nama_siswa, kondisi, fokus, catatan)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                kondisi = VALUES(kondisi),
                fokus = VALUES(fokus),
                catatan = VALUES(catatan)`,
            [
                sesiId,
                c.user_id,
                c.nama_siswa,
                c.kondisi || 'baik',
                c.fokus || 'fokus',
                c.catatan || null
            ]
        );
    }
}

// =====================================================================
// SUBMIT LENGKAP (absensi + report + catatan sekaligus)
// =====================================================================

async function submitSesi(sesiId, { absensi, report, catatan_siswa }) {
    if (absensi) await saveAbsensi(sesiId, absensi);
    if (report) await saveReport(sesiId, report);
    if (catatan_siswa) await saveCatatanSiswa(sesiId, catatan_siswa);
    await updateSesiStatus(sesiId, 'selesai');
}

// =====================================================================
// STATISTIK untuk admin
// =====================================================================

async function getStatsByGuru() {
    const [rows] = await pool.execute(
        `SELECT
            sk.guru_id,
            sk.guru_nama,
            COUNT(sk.id) AS total_sesi,
            SUM(CASE WHEN sk.status = 'selesai' THEN 1 ELSE 0 END) AS sesi_selesai,
            MAX(sk.tanggal) AS sesi_terakhir
         FROM sesi_kelas sk
         GROUP BY sk.guru_id, sk.guru_nama
         ORDER BY sesi_terakhir DESC`
    );
    return rows;
}

// Rekap absensi semua sesi - untuk halaman admin absensi
async function getRekapAbsensi({ guru_id, jenjang, tanggal_dari, tanggal_sampai } = {}) {
    const conditions = [];
    const params = [];

    if (guru_id) { conditions.push('sk.guru_id = ?'); params.push(guru_id); }
    if (jenjang) { conditions.push('sk.jenjang = ?'); params.push(jenjang); }
    if (tanggal_dari) { conditions.push('sk.tanggal >= ?'); params.push(tanggal_dari); }
    if (tanggal_sampai) { conditions.push('sk.tanggal <= ?'); params.push(tanggal_sampai); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.execute(
        `SELECT
            sk.id AS sesi_id,
            sk.tanggal,
            sk.guru_id,
            sk.guru_nama,
            sk.jenjang,
            sk.mapel,
            sk.durasi_menit,
            sk.status AS status_sesi,
            sa.user_id,
            sa.nama_siswa,
            sa.status AS status_absensi,
            sa.catatan AS catatan_absensi,
            sr.topik,
            sr.capaian
         FROM sesi_kelas sk
         LEFT JOIN sesi_absensi sa ON sa.sesi_id = sk.id
         LEFT JOIN sesi_report sr ON sr.sesi_id = sk.id
         ${where}
         ORDER BY sk.tanggal DESC, sk.id DESC, sa.nama_siswa ASC`,
        params
    );
    return rows;
}

module.exports = {
    createSesi,
    getRekapAbsensi,
    updateSesi,
    getSesiByGuru,
    getAllSesi,
    getSesiById,
    updateSesiStatus,
    deleteSesi,
    saveAbsensi,
    saveReport,
    saveCatatanSiswa,
    submitSesi,
    getStatsByGuru
};
