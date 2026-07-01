const { pool } = require('../config/db');
const { generateSlug, generateSequenceToken, shuffleArray } = require('./latihanHelpers');

// =====================================================================
// PAKET LATIHAN — READ
// =====================================================================

/**
 * Ambil paket latihan untuk siswa:
 *   - Hanya paket aktif
 *   - Hanya dari guru yang mengajar siswa ini (jika userId diberikan)
 *   - Atau paket tanpa created_by (paket yang dibuat admin/tanpa owner)
 */
async function getPaketByKategori(userId = null) {
    let whereExtra = '';
    const params = [];

    if (userId) {
        whereExtra = `
            AND (
                lp.created_by IS NULL
                OR lp.created_by IN (
                    SELECT gs.guru_id FROM guru_siswa gs WHERE gs.siswa_id = ?
                )
                OR lp.created_by IN (
                    SELECT id FROM users WHERE role = 'admin'
                )
            )
        `;
        params.push(userId);
    }

    const [rows] = await pool.execute(`
        SELECT lp.*, c.name AS category_name, c.code AS category_code,
               c.slug AS category_slug, COUNT(lpq.id) AS question_count
        FROM latihan_paket lp
        LEFT JOIN categories c ON c.id = lp.category_id
        LEFT JOIN latihan_paket_questions lpq ON lpq.paket_id = lp.id
        WHERE lp.is_active = 1 ${whereExtra}
        GROUP BY lp.id
        ORDER BY c.sort_order ASC, lp.sort_order ASC
    `, params);

    // Ambil semua attempt in_progress milik user sekaligus (1 query)
    let activeAttemptMap = {};
    if (userId && rows.length > 0) {
        const paketIds = rows.map(r => r.id);
        const placeholders = paketIds.map(() => '?').join(',');
        const [activeAttempts] = await pool.execute(
            `SELECT id, paket_id, started_at, due_at
             FROM latihan_attempts
             WHERE paket_id IN (${placeholders}) AND user_id = ? AND status = 'in_progress'
             ORDER BY id DESC`,
            [...paketIds, userId]
        );
        // Ambil hanya yang belum expired, satu per paket
        const now = new Date();
        for (const a of activeAttempts) {
            if (activeAttemptMap[a.paket_id]) continue; // sudah ada (ambil yang terbaru)
            if (a.due_at && now > new Date(a.due_at)) continue; // skip expired
            const time_left_seconds = a.due_at
                ? Math.max(0, Math.floor((new Date(a.due_at) - now) / 1000))
                : null;
            activeAttemptMap[a.paket_id] = { id: a.id, started_at: a.started_at, time_left_seconds };
        }
    }

    const grouped = {};
    for (const row of rows) {
        const key = row.category_id || 'uncategorized';
        if (!grouped[key]) {
            grouped[key] = {
                category_id: row.category_id,
                category_name: row.category_name || 'Lainnya',
                category_code: row.category_code,
                category_slug: row.category_slug,
                pakets: []
            };
        }
        grouped[key].pakets.push({
            id: row.id,
            name: row.name,
            slug: row.slug,
            description: row.description,
            total_questions: row.question_count || row.total_questions,
            duration_minutes: row.duration_minutes,
            shuffle_questions: !!row.shuffle_questions,
            shuffle_options: !!row.shuffle_options,
            difficulty: row.difficulty,
            sort_order: row.sort_order,
            active_attempt: activeAttemptMap[row.id] || null
        });
    }
    return Object.values(grouped);
}

async function getPaketById(paketId) {
    const [[paket]] = await pool.execute(
        `SELECT lp.*, c.name AS category_name, c.code AS category_code
         FROM latihan_paket lp
         LEFT JOIN categories c ON c.id = lp.category_id
         WHERE lp.id = ?`,
        [paketId]
    );
    if (!paket) return null;

    const [questions] = await pool.execute(`
        SELECT q.id, q.type, q.content, q.explanation, q.difficulty,
               q.default_marks, q.penalty, lpq.sort_order, lpq.marks
        FROM latihan_paket_questions lpq
        JOIN questions q ON q.id = lpq.question_id
        WHERE lpq.paket_id = ?
        ORDER BY lpq.sort_order ASC
    `, [paketId]);

    if (questions.length > 0) {
        const qIds = questions.map(q => q.id);
        const ph = qIds.map(() => '?').join(',');
        const [options] = await pool.execute(
            `SELECT id, question_id, content, is_correct, sort_order
             FROM question_options WHERE question_id IN (${ph}) ORDER BY sort_order ASC`,
            qIds
        );
        const [images] = await pool.execute(
            `SELECT id, question_id, option_id, url, alt_text, position
             FROM question_images WHERE question_id IN (${ph})`,
            qIds
        );
        const optMap = {};
        const imgMap = {};
        options.forEach(o => { if (!optMap[o.question_id]) optMap[o.question_id] = []; optMap[o.question_id].push(o); });
        images.forEach(i => { if (!imgMap[i.question_id]) imgMap[i.question_id] = []; imgMap[i.question_id].push(i); });
        questions.forEach(q => {
            q.options = (optMap[q.id] || []).map(o => ({ id: o.id, content: o.content, sort_order: o.sort_order }));
            q.images = imgMap[q.id] || [];
        });
    }
    return { ...paket, questions };
}

// =====================================================================
// PAKET LATIHAN — CRUD (admin)
// =====================================================================

async function createPaket(data) {
    const slug = generateSlug(data.name);
    const [result] = await pool.execute(
        `INSERT INTO latihan_paket
         (category_id, name, slug, description, duration_minutes,
          shuffle_questions, shuffle_options, difficulty, sort_order, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            data.category_id || null, data.name, slug, data.description || null,
            data.duration_minutes || null,
            data.shuffle_questions ? 1 : 0,
            data.shuffle_options ? 1 : 0,
            data.difficulty || 'mixed', data.sort_order || 0, data.created_by || null
        ]
    );
    return result.insertId;
}

async function updatePaket(paketId, data) {
    const fields = [];
    const params = [];
    const map = {
        name: 'name', category_id: 'category_id', description: 'description',
        duration_minutes: 'duration_minutes', difficulty: 'difficulty',
        sort_order: 'sort_order', is_active: 'is_active'
    };
    for (const [key, col] of Object.entries(map)) {
        if (data[key] !== undefined) { fields.push(`${col} = ?`); params.push(data[key]); }
    }
    if (data.shuffle_questions !== undefined) { fields.push('shuffle_questions = ?'); params.push(data.shuffle_questions ? 1 : 0); }
    if (data.shuffle_options !== undefined)   { fields.push('shuffle_options = ?');   params.push(data.shuffle_options ? 1 : 0); }
    if (fields.length === 0) return;
    params.push(paketId);
    await pool.execute(`UPDATE latihan_paket SET ${fields.join(', ')} WHERE id = ?`, params);
}

async function deletePaket(paketId) {
    await pool.execute('DELETE FROM latihan_paket WHERE id = ?', [paketId]);
}

async function setPaketQuestions(paketId, questionIds) {
    await pool.execute('DELETE FROM latihan_paket_questions WHERE paket_id = ?', [paketId]);
    if (questionIds.length === 0) {
        await pool.execute('UPDATE latihan_paket SET total_questions = 0 WHERE id = ?', [paketId]);
        return;
    }
    const values = questionIds.map(() => '(?, ?, ?, 1.00)').join(', ');
    const params = questionIds.flatMap((qId, i) => [paketId, qId, i + 1]);
    await pool.execute(
        `INSERT INTO latihan_paket_questions (paket_id, question_id, sort_order, marks) VALUES ${values}`,
        params
    );
    await pool.execute('UPDATE latihan_paket SET total_questions = ? WHERE id = ?', [questionIds.length, paketId]);
}

module.exports = {
    getPaketByKategori, getPaketById,
    createPaket, updatePaket, deletePaket, setPaketQuestions,
    // attempt engine — akan di-require dari latihanAttemptService
    startAttempt: require('./latihanAttemptService').startAttempt,
    saveAnswer: require('./latihanAttemptService').saveAnswer,
    submitAttempt: require('./latihanAttemptService').submitAttempt,
    getAttemptAnswers: require('./latihanAttemptService').getAttemptAnswers,
    getAttemptResult: require('./latihanAttemptService').getAttemptResult,
    getRiwayatSiswa: require('./latihanAttemptService').getRiwayatSiswa,
    generateSequenceToken, shuffleArray
};
