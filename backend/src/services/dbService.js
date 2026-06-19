const { pool } = require('../config/db');

// Konversi ISO string ke format MySQL datetime
function toMySQLDatetime(isoString) {
    if (!isoString) return null;
    return new Date(isoString).toISOString().slice(0, 19).replace('T', ' ');
}

// Simpan atau update hasil tryout
async function simpanHasil(data) {
    const query = `
        INSERT INTO tryout_results 
            (attempt_id, user_id, quiz_id, nama_siswa, nama_tryout, waktu_selesai,
             skor_subtes, analisis_soal, ai_insight)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            nama_siswa = VALUES(nama_siswa),
            nama_tryout = VALUES(nama_tryout),
            waktu_selesai = VALUES(waktu_selesai),
            skor_subtes = VALUES(skor_subtes),
            analisis_soal = VALUES(analisis_soal),
            ai_insight = VALUES(ai_insight),
            updated_at = CURRENT_TIMESTAMP
    `;

    const [result] = await pool.execute(query, [
        data.attempt_id,
        data.user_id,
        data.quiz_id,
        data.nama_siswa,
        data.nama_tryout,
        toMySQLDatetime(data.waktu_selesai),
        JSON.stringify(data.skor_subtes),
        JSON.stringify(data.analisis_soal || {}),
        data.ai_insight || null
    ]);

    return result;
}

// Ambil hasil tryout dari DB (lebih cepat dari Moodle API)
async function getHasilFromDB(userId, quizId) {
    const [rows] = await pool.execute(
        'SELECT * FROM tryout_results WHERE user_id = ? AND quiz_id = ? ORDER BY id DESC LIMIT 1',
        [userId, quizId]
    );

    if (rows.length === 0) return null;

    const row = rows[0];

    // Support schema lama (subtest_scores) dan baru (skor_subtes)
    const skorSubtes = row.skor_subtes || row.subtest_scores;
    const aiInsight = row.ai_insight || row.ai_analysis;

    return {
        ...row,
        nama_siswa: row.nama_siswa || row.student_name,
        skor_subtes: typeof skorSubtes === 'string' ? JSON.parse(skorSubtes) : skorSubtes,
        analisis_soal: typeof row.analisis_soal === 'string' ? JSON.parse(row.analisis_soal) : (row.analisis_soal || {}),
        ai_insight: typeof aiInsight === 'string' ? aiInsight : null
    };
}

// Ambil semua riwayat siswa dari DB
async function getRiwayatFromDB(userId) {
    const [rows] = await pool.execute(
        'SELECT * FROM tryout_results WHERE user_id = ? ORDER BY id DESC',
        [userId]
    );

    return rows.map(row => {
        const skorSubtes = row.skor_subtes || row.subtest_scores;
        const aiInsight = row.ai_insight || row.ai_analysis;
        return {
            ...row,
            nama_siswa: row.nama_siswa || row.student_name,
            skor_subtes: typeof skorSubtes === 'string' ? JSON.parse(skorSubtes) : skorSubtes,
            analisis_soal: typeof row.analisis_soal === 'string' ? JSON.parse(row.analisis_soal) : (row.analisis_soal || {}),
            ai_insight: typeof aiInsight === 'string' ? aiInsight : null
        };
    });
}

// Ambil ranking semua siswa untuk quiz tertentu
async function getRanking(quizId) {
    const [rows] = await pool.execute(`
        SELECT 
            user_id,
            nama_siswa,
            quiz_id,
            nama_tryout,
            JSON_EXTRACT(skor_subtes, '$.total.skor') as skor_total,
            waktu_selesai
        FROM tryout_results
        WHERE quiz_id = ?
        ORDER BY skor_total DESC
    `, [quizId]);

    return rows.map((row, index) => ({
        rank: index + 1,
        ...row
    }));
}

module.exports = { simpanHasil, getHasilFromDB, getRiwayatFromDB, getRanking };