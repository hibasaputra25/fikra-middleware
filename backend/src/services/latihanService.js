const { pool } = require('../config/db');

// =====================================================================
// PAKET LATIHAN
// =====================================================================

// Ambil semua paket latihan, dikelompokkan per kategori
async function getPaketByKategori() {
    const [rows] = await pool.execute(`
        SELECT
            lp.*,
            c.name AS category_name,
            c.code AS category_code,
            c.slug AS category_slug,
            COUNT(lpq.id) AS question_count
        FROM latihan_paket lp
        LEFT JOIN categories c ON c.id = lp.category_id
        LEFT JOIN latihan_paket_questions lpq ON lpq.paket_id = lp.id
        WHERE lp.is_active = 1
        GROUP BY lp.id
        ORDER BY c.sort_order ASC, lp.sort_order ASC
    `);

    // Kelompokkan per kategori
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
            difficulty: row.difficulty,
            sort_order: row.sort_order
        });
    }

    return Object.values(grouped);
}

// Ambil satu paket dengan soal-soalnya
async function getPaketById(paketId) {
    const [[paket]] = await pool.execute(
        `SELECT lp.*, c.name AS category_name, c.code AS category_code
         FROM latihan_paket lp
         LEFT JOIN categories c ON c.id = lp.category_id
         WHERE lp.id = ? AND lp.is_active = 1`,
        [paketId]
    );

    if (!paket) return null;

    // Ambil soal dalam paket
    const [questions] = await pool.execute(`
        SELECT
            q.id, q.type, q.content, q.explanation, q.difficulty,
            q.default_marks, q.penalty, q.shuffle_options,
            lpq.sort_order, lpq.marks
        FROM latihan_paket_questions lpq
        JOIN questions q ON q.id = lpq.question_id
        WHERE lpq.paket_id = ?
        ORDER BY lpq.sort_order ASC
    `, [paketId]);

    // Ambil options untuk setiap soal
    if (questions.length > 0) {
        const questionIds = questions.map(q => q.id);
        const placeholders = questionIds.map(() => '?').join(',');

        const [options] = await pool.execute(
            `SELECT id, question_id, content, is_correct, sort_order
             FROM question_options
             WHERE question_id IN (${placeholders})
             ORDER BY sort_order ASC`,
            questionIds
        );

        const [images] = await pool.execute(
            `SELECT id, question_id, option_id, url, alt_text, position
             FROM question_images
             WHERE question_id IN (${placeholders})`,
            questionIds
        );

        // Map options dan images ke soal
        const optionsMap = {};
        const imagesMap = {};
        options.forEach(o => {
            if (!optionsMap[o.question_id]) optionsMap[o.question_id] = [];
            optionsMap[o.question_id].push(o);
        });
        images.forEach(i => {
            if (!imagesMap[i.question_id]) imagesMap[i.question_id] = [];
            imagesMap[i.question_id].push(i);
        });

        questions.forEach(q => {
            q.options = optionsMap[q.id] || [];
            q.images = imagesMap[q.id] || [];
            // Sembunyikan is_correct saat ambil soal (bukan saat review)
            q.options = q.options.map(o => ({
                id: o.id,
                content: o.content,
                sort_order: o.sort_order
                // is_correct sengaja tidak disertakan
            }));
        });
    }

    return { ...paket, questions };
}

// CRUD paket untuk admin
async function createPaket(data) {
    const slug = generateSlug(data.name);
    const [result] = await pool.execute(
        `INSERT INTO latihan_paket
         (category_id, name, slug, description, duration_minutes, difficulty, sort_order, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            data.category_id || null,
            data.name,
            slug,
            data.description || null,
            data.duration_minutes || null,
            data.difficulty || 'mixed',
            data.sort_order || 0,
            data.created_by || null
        ]
    );
    return result.insertId;
}

async function updatePaket(paketId, data) {
    const fields = [];
    const params = [];

    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
    if (data.category_id !== undefined) { fields.push('category_id = ?'); params.push(data.category_id); }
    if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description); }
    if (data.duration_minutes !== undefined) { fields.push('duration_minutes = ?'); params.push(data.duration_minutes); }
    if (data.difficulty !== undefined) { fields.push('difficulty = ?'); params.push(data.difficulty); }
    if (data.sort_order !== undefined) { fields.push('sort_order = ?'); params.push(data.sort_order); }
    if (data.is_active !== undefined) { fields.push('is_active = ?'); params.push(data.is_active); }

    if (fields.length === 0) return;
    params.push(paketId);

    await pool.execute(
        `UPDATE latihan_paket SET ${fields.join(', ')} WHERE id = ?`,
        params
    );
}

async function deletePaket(paketId) {
    await pool.execute('DELETE FROM latihan_paket WHERE id = ?', [paketId]);
}

// Tambah soal ke paket
async function setPaketQuestions(paketId, questionIds) {
    // Hapus semua soal lama
    await pool.execute('DELETE FROM latihan_paket_questions WHERE paket_id = ?', [paketId]);

    if (questionIds.length === 0) {
        await pool.execute('UPDATE latihan_paket SET total_questions = 0 WHERE id = ?', [paketId]);
        return;
    }

    // Insert soal baru
    const values = questionIds.map((qId, i) => `(?, ?, ?, 1.00)`).join(', ');
    const params = questionIds.flatMap((qId, i) => [paketId, qId, i + 1]);
    await pool.execute(
        `INSERT INTO latihan_paket_questions (paket_id, question_id, sort_order, marks) VALUES ${values}`,
        params
    );

    // Update total_questions
    await pool.execute(
        'UPDATE latihan_paket SET total_questions = ? WHERE id = ?',
        [questionIds.length, paketId]
    );
}

// =====================================================================
// ATTEMPT ENGINE
// =====================================================================

// Mulai atau lanjutkan attempt latihan
async function startAttempt(paketId, userId) {
    // Cek apakah ada attempt in_progress
    const [[existing]] = await pool.execute(
        `SELECT * FROM latihan_attempts
         WHERE paket_id = ? AND user_id = ? AND status = 'in_progress'
         ORDER BY id DESC LIMIT 1`,
        [paketId, userId]
    );

    if (existing) {
        // Lanjutkan attempt yang sudah ada
        const answers = await getAttemptAnswers(existing.id);
        return { attempt: existing, answers, is_new: false };
    }

    // Buat attempt baru
    const [result] = await pool.execute(
        `INSERT INTO latihan_attempts (paket_id, user_id, status, started_at)
         VALUES (?, ?, 'in_progress', NOW())`,
        [paketId, userId]
    );

    const [[attempt]] = await pool.execute(
        'SELECT * FROM latihan_attempts WHERE id = ?',
        [result.insertId]
    );

    return { attempt, answers: [], is_new: true };
}

// Simpan jawaban siswa
async function saveAnswer(attemptId, questionId, data) {
    const {
        selected_option_ids = null,
        answer_text = null,
        is_flagged = false
    } = data;

    await pool.execute(
        `INSERT INTO latihan_attempt_answers
             (attempt_id, question_id, selected_option_ids, answer_text, is_flagged, answered_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
             selected_option_ids = VALUES(selected_option_ids),
             answer_text = VALUES(answer_text),
             is_flagged = VALUES(is_flagged),
             answered_at = NOW()`,
        [
            attemptId,
            questionId,
            selected_option_ids ? JSON.stringify(selected_option_ids) : null,
            answer_text || null,
            is_flagged ? 1 : 0
        ]
    );
}

// Submit attempt — hitung skor
async function submitAttempt(attemptId, userId) {
    // Ambil attempt
    const [[attempt]] = await pool.execute(
        'SELECT * FROM latihan_attempts WHERE id = ? AND user_id = ?',
        [attemptId, userId]
    );

    if (!attempt) throw new Error('Attempt tidak ditemukan');
    if (attempt.status === 'submitted') throw new Error('Attempt sudah disubmit');

    // Ambil soal dalam paket beserta jawaban yang benar
    const [questions] = await pool.execute(`
        SELECT
            q.id AS question_id,
            q.type,
            q.default_marks,
            q.penalty,
            lpq.marks
        FROM latihan_paket_questions lpq
        JOIN questions q ON q.id = lpq.question_id
        WHERE lpq.paket_id = ?
        ORDER BY lpq.sort_order ASC
    `, [attempt.paket_id]);

    // Ambil options yang benar untuk setiap soal
    const questionIds = questions.map(q => q.question_id);
    const placeholders = questionIds.map(() => '?').join(',');

    const [correctOptions] = await pool.execute(
        `SELECT question_id, id AS option_id
         FROM question_options
         WHERE question_id IN (${placeholders}) AND is_correct = 1`,
        questionIds
    );

    // Map correct options per question
    const correctMap = {};
    correctOptions.forEach(o => {
        if (!correctMap[o.question_id]) correctMap[o.question_id] = [];
        correctMap[o.question_id].push(o.option_id);
    });

    // Ambil jawaban siswa
    const answers = await getAttemptAnswers(attemptId);
    const answersMap = {};
    answers.forEach(a => { answersMap[a.question_id] = a; });

    // Hitung skor per soal
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalMarks = 0;
    let earnedMarks = 0;

    for (const q of questions) {
        const answer = answersMap[q.question_id];
        const correct = correctMap[q.question_id] || [];
        const marks = parseFloat(q.marks) || 1;
        totalMarks += marks;

        let isCorrect = null;
        let marksEarned = 0;

        if (answer && (answer.selected_option_ids || answer.answer_text)) {
            if (q.type === 'mcq_single' || q.type === 'true_false') {
                const selected = answer.selected_option_ids?.[0];
                isCorrect = correct.includes(selected) ? 1 : 0;
                marksEarned = isCorrect ? marks : -parseFloat(q.penalty || 0);
            } else if (q.type === 'mcq_multi') {
                const selected = new Set(answer.selected_option_ids || []);
                const correctSet = new Set(correct);
                const allCorrect = [...correctSet].every(id => selected.has(id)) &&
                                   [...selected].every(id => correctSet.has(id));
                isCorrect = allCorrect ? 1 : 0;
                marksEarned = isCorrect ? marks : 0;
            } else {
                // essay/short_answer — belum bisa auto-grade
                isCorrect = null;
                marksEarned = 0;
            }
        }

        if (isCorrect === 1) totalCorrect++;
        if (isCorrect === 0) totalWrong++;
        earnedMarks += marksEarned;

        // Update is_correct dan marks_earned di jawaban
        await pool.execute(
            `UPDATE latihan_attempt_answers
             SET is_correct = ?, marks_earned = ?
             WHERE attempt_id = ? AND question_id = ?`,
            [isCorrect, marksEarned, attemptId, q.question_id]
        );
    }

    const totalScore = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
    const timeSpent = Math.round((Date.now() - new Date(attempt.started_at).getTime()) / 1000);

    // Update attempt
    await pool.execute(
        `UPDATE latihan_attempts
         SET status = 'submitted', finished_at = NOW(),
             total_correct = ?, total_wrong = ?,
             total_score = ?, time_spent_seconds = ?
         WHERE id = ?`,
        [totalCorrect, totalWrong, totalScore, timeSpent, attemptId]
    );

    return { totalCorrect, totalWrong, totalScore, totalMarks, earnedMarks };
}

// Ambil semua jawaban dalam satu attempt
async function getAttemptAnswers(attemptId) {
    const [rows] = await pool.execute(
        `SELECT question_id, selected_option_ids, answer_text, is_correct, is_flagged, marks_earned
         FROM latihan_attempt_answers
         WHERE attempt_id = ?`,
        [attemptId]
    );
    return rows.map(r => ({
        ...r,
        selected_option_ids: typeof r.selected_option_ids === 'string'
            ? JSON.parse(r.selected_option_ids)
            : (r.selected_option_ids || [])
    }));
}

// Ambil hasil attempt dengan detail soal (untuk halaman review)
async function getAttemptResult(attemptId, userId) {
    const [[attempt]] = await pool.execute(
        `SELECT la.*, lp.name AS paket_name, lp.duration_minutes,
                c.name AS category_name, c.code AS category_code
         FROM latihan_attempts la
         JOIN latihan_paket lp ON lp.id = la.paket_id
         LEFT JOIN categories c ON c.id = lp.category_id
         WHERE la.id = ? AND la.user_id = ?`,
        [attemptId, userId]
    );

    if (!attempt) throw new Error('Hasil tidak ditemukan');

    // Ambil soal + jawaban siswa + jawaban benar
    const [questions] = await pool.execute(`
        SELECT
            q.id, q.type, q.content, q.explanation, q.difficulty,
            lpq.sort_order, lpq.marks,
            laa.selected_option_ids, laa.answer_text,
            laa.is_correct, laa.is_flagged, laa.marks_earned
        FROM latihan_paket_questions lpq
        JOIN questions q ON q.id = lpq.question_id
        LEFT JOIN latihan_attempt_answers laa
            ON laa.attempt_id = ? AND laa.question_id = q.id
        WHERE lpq.paket_id = ?
        ORDER BY lpq.sort_order ASC
    `, [attemptId, attempt.paket_id]);

    // Ambil options dengan is_correct untuk review
    if (questions.length > 0) {
        const qIds = questions.map(q => q.id);
        const ph = qIds.map(() => '?').join(',');
        const [options] = await pool.execute(
            `SELECT id, question_id, content, is_correct, sort_order
             FROM question_options WHERE question_id IN (${ph})
             ORDER BY sort_order ASC`,
            qIds
        );
        const optMap = {};
        options.forEach(o => {
            if (!optMap[o.question_id]) optMap[o.question_id] = [];
            optMap[o.question_id].push(o);
        });
        questions.forEach(q => {
            q.options = optMap[q.id] || [];
            q.selected_option_ids = typeof q.selected_option_ids === 'string'
                ? JSON.parse(q.selected_option_ids)
                : (q.selected_option_ids || []);
        });
    }

    return { attempt, questions };
}

// Riwayat latihan siswa
async function getRiwayatSiswa(userId, limit = 20) {
    const [rows] = await pool.execute(`
        SELECT
            la.*,
            lp.name AS paket_name,
            c.name AS category_name,
            c.code AS category_code
        FROM latihan_attempts la
        JOIN latihan_paket lp ON lp.id = la.paket_id
        LEFT JOIN categories c ON c.id = lp.category_id
        WHERE la.user_id = ? AND la.status = 'submitted'
        ORDER BY la.finished_at DESC
        LIMIT ?
    `, [userId, limit]);
    return rows;
}

// =====================================================================
// HELPERS
// =====================================================================

function generateSlug(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim() + '-' + Date.now();
}

module.exports = {
    getPaketByKategori,
    getPaketById,
    createPaket,
    updatePaket,
    deletePaket,
    setPaketQuestions,
    startAttempt,
    saveAnswer,
    submitAttempt,
    getAttemptAnswers,
    getAttemptResult,
    getRiwayatSiswa
};
