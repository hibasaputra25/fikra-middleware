const { pool } = require('../config/db');
const { generateSequenceToken, shuffleArray, gradeShortAnswer, gradeNumeric } = require('./latihanHelpers');

// =====================================================================
// ATTEMPT ENGINE
// =====================================================================

async function startAttempt(paketId, userId) {
    const [[existing]] = await pool.execute(
        `SELECT * FROM latihan_attempts
         WHERE paket_id = ? AND user_id = ? AND status = 'in_progress'
         ORDER BY id DESC LIMIT 1`,
        [paketId, userId]
    );

    if (existing) {
        if (existing.due_at && new Date() > new Date(existing.due_at)) {
            await pool.execute(
                `UPDATE latihan_attempts SET status = 'abandoned' WHERE id = ?`,
                [existing.id]
            );
        } else {
            const answers = await getAttemptAnswers(existing.id);
            const questionOrder = await getAttemptQuestionOrder(existing.id);
            return { attempt: existing, answers, question_order: questionOrder, is_new: false };
        }
    }

    const [[paket]] = await pool.execute(
        'SELECT id, duration_minutes, shuffle_questions, shuffle_options FROM latihan_paket WHERE id = ?',
        [paketId]
    );
    if (!paket) throw new Error('Paket tidak ditemukan');

    const [result] = await pool.execute(
        `INSERT INTO latihan_attempts (paket_id, user_id, status, started_at, due_at)
         VALUES (?, ?, 'in_progress', NOW(), IF(? IS NULL, NULL, DATE_ADD(NOW(), INTERVAL ? MINUTE)))`,
        [paketId, userId, paket.duration_minutes || null, paket.duration_minutes || null]
    );
    const attemptId = result.insertId;

    // Tentukan urutan soal (shuffle jika diaktifkan)
    const [rows] = await pool.execute(
        `SELECT question_id FROM latihan_paket_questions WHERE paket_id = ? ORDER BY sort_order ASC`,
        [paketId]
    );
    let questionOrder = rows.map(r => r.question_id);
    if (paket.shuffle_questions) questionOrder = shuffleArray(questionOrder);

    // Simpan urutan soal per-attempt
    if (questionOrder.length > 0) {
        const orderVals = questionOrder.map((qId, i) => `(${attemptId}, ${qId}, ${i + 1})`).join(', ');
        await pool.execute(
            `INSERT INTO latihan_attempt_questions (attempt_id, question_id, sort_order) VALUES ${orderVals}`
        );
    }

    // Generate sequence_token dan option_order per soal
    let optionsByQuestion = {};
    if (paket.shuffle_options && questionOrder.length > 0) {
        const ph = questionOrder.map(() => '?').join(',');
        const [options] = await pool.execute(
            `SELECT id, question_id FROM question_options WHERE question_id IN (${ph}) ORDER BY sort_order ASC`,
            questionOrder
        );
        options.forEach(o => {
            if (!optionsByQuestion[o.question_id]) optionsByQuestion[o.question_id] = [];
            optionsByQuestion[o.question_id].push(o.id);
        });
    }

    for (const qId of questionOrder) {
        const token = generateSequenceToken(attemptId, qId);
        const optionOrder = paket.shuffle_options
            ? shuffleArray(optionsByQuestion[qId] || [])
            : null;
        await pool.execute(
            `INSERT INTO latihan_attempt_answers (attempt_id, question_id, sequence_token, option_order)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 sequence_token = VALUES(sequence_token),
                 option_order   = VALUES(option_order)`,
            [attemptId, qId, token, optionOrder ? JSON.stringify(optionOrder) : null]
        );
    }

    const [[attempt]] = await pool.execute(
        'SELECT * FROM latihan_attempts WHERE id = ?', [attemptId]
    );
    return { attempt, answers: [], question_order: questionOrder, is_new: true };
}

async function saveAnswer(attemptId, questionId, data) {
    const { selected_option_ids = null, answer_text = null, is_flagged = false, sequence_token = null } = data;

    const [[row]] = await pool.execute(
        `SELECT la.status, la.due_at, laa.sequence_token AS stored_token
         FROM latihan_attempts la
         LEFT JOIN latihan_attempt_answers laa
             ON laa.attempt_id = la.id AND laa.question_id = ?
         WHERE la.id = ?`,
        [questionId, attemptId]
    );

    if (!row) throw new Error('Attempt tidak ditemukan');
    if (row.status !== 'in_progress') throw new Error('Attempt sudah tidak aktif');

    if (row.due_at && new Date() > new Date(row.due_at)) {
        await pool.execute(`UPDATE latihan_attempts SET status = 'abandoned' WHERE id = ?`, [attemptId]);
        throw new Error('Waktu pengerjaan sudah habis');
    }

    if (row.stored_token && sequence_token !== row.stored_token) {
        throw new Error('Token tidak valid');
    }

    await pool.execute(
        `INSERT INTO latihan_attempt_answers
             (attempt_id, question_id, selected_option_ids, answer_text, is_flagged, answered_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
             selected_option_ids = VALUES(selected_option_ids),
             answer_text         = VALUES(answer_text),
             is_flagged          = VALUES(is_flagged),
             answered_at         = NOW()`,
        [
            attemptId, questionId,
            selected_option_ids ? JSON.stringify(selected_option_ids) : null,
            answer_text || null,
            is_flagged ? 1 : 0
        ]
    );
}

async function submitAttempt(attemptId, userId) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[attempt]] = await conn.execute(
            'SELECT * FROM latihan_attempts WHERE id = ? AND user_id = ? FOR UPDATE',
            [attemptId, userId]
        );
        if (!attempt) throw new Error('Attempt tidak ditemukan');
        if (attempt.status === 'submitted') throw new Error('Attempt sudah disubmit');
        if (attempt.status === 'abandoned') throw new Error('Attempt sudah berakhir');

        // Server-side timer enforcement dengan 60 detik grace period
        if (attempt.due_at) {
            const deadline = new Date(new Date(attempt.due_at).getTime() + 60_000);
            if (new Date() > deadline) {
                await conn.execute(`UPDATE latihan_attempts SET status = 'abandoned' WHERE id = ?`, [attemptId]);
                await conn.commit();
                throw new Error('Waktu pengerjaan sudah habis');
            }
        }

        const [questions] = await conn.execute(`
            SELECT q.id AS question_id, q.type, q.penalty, lpq.marks
            FROM latihan_paket_questions lpq
            JOIN questions q ON q.id = lpq.question_id
            WHERE lpq.paket_id = ?`, [attempt.paket_id]
        );

        const qIds = questions.map(q => q.question_id);
        const ph = qIds.map(() => '?').join(',');

        const [correctOptions] = await conn.execute(
            `SELECT question_id, id AS option_id FROM question_options
             WHERE question_id IN (${ph}) AND is_correct = 1`, qIds
        );
        const [answerKeys] = await conn.execute(
            `SELECT question_id, answer_text, numeric_value, numeric_tolerance, match_type
             FROM question_answers WHERE question_id IN (${ph})`, qIds
        );
        const [rawAnswers] = await conn.execute(
            `SELECT question_id, selected_option_ids, answer_text
             FROM latihan_attempt_answers WHERE attempt_id = ?`, [attemptId]
        );

        const correctMap = {};
        correctOptions.forEach(o => {
            if (!correctMap[o.question_id]) correctMap[o.question_id] = [];
            correctMap[o.question_id].push(o.option_id);
        });
        const keyMap = {};
        answerKeys.forEach(a => {
            if (!keyMap[a.question_id]) keyMap[a.question_id] = [];
            keyMap[a.question_id].push(a);
        });
        const answersMap = {};
        rawAnswers.forEach(a => {
            answersMap[a.question_id] = {
                ...a,
                selected_option_ids: typeof a.selected_option_ids === 'string'
                    ? JSON.parse(a.selected_option_ids) : (a.selected_option_ids || [])
            };
        });

        let totalCorrect = 0, totalWrong = 0, totalMarks = 0, earnedMarks = 0;

        for (const q of questions) {
            const answer = answersMap[q.question_id];
            const correct = correctMap[q.question_id] || [];
            const keys = keyMap[q.question_id] || [];
            const marks = parseFloat(q.marks) || 1;
            const penalty = parseFloat(q.penalty) || 0;
            totalMarks += marks;

            let isCorrect = null;
            let marksEarned = 0;

            const hasAnswer = answer && (answer.selected_option_ids?.length > 0 || answer.answer_text);
            if (hasAnswer) {
                if (q.type === 'mcq_single' || q.type === 'true_false') {
                    const sel = answer.selected_option_ids?.[0];
                    isCorrect = correct.includes(sel) ? 1 : 0;
                    marksEarned = isCorrect ? marks : -penalty;

                } else if (q.type === 'mcq_multi') {
                    const sel = new Set(answer.selected_option_ids || []);
                    const cor = new Set(correct);
                    const correctHits = [...sel].filter(id => cor.has(id)).length;
                    const wrongHits   = [...sel].filter(id => !cor.has(id)).length;
                    if (correctHits === cor.size && wrongHits === 0) {
                        isCorrect = 1;
                        marksEarned = marks;
                    } else if (correctHits > 0 && wrongHits === 0) {
                        isCorrect = 0;
                        marksEarned = (correctHits / cor.size) * marks * 0.5;
                    } else {
                        isCorrect = 0;
                        marksEarned = -penalty;
                    }

                } else if (q.type === 'short_answer') {
                    isCorrect = gradeShortAnswer(answer.answer_text, keys) ? 1 : 0;
                    marksEarned = isCorrect ? marks : -penalty;

                } else if (q.type === 'numeric') {
                    isCorrect = gradeNumeric(answer.answer_text, keys) ? 1 : 0;
                    marksEarned = isCorrect ? marks : -penalty;

                } else {
                    // essay — manual grade
                    isCorrect = null;
                    marksEarned = 0;
                }
            }

            if (isCorrect === 1) totalCorrect++;
            if (isCorrect === 0) totalWrong++;
            earnedMarks += marksEarned;

            await conn.execute(
                `UPDATE latihan_attempt_answers SET is_correct = ?, marks_earned = ?
                 WHERE attempt_id = ? AND question_id = ?`,
                [isCorrect, marksEarned, attemptId, q.question_id]
            );
        }

        const totalScore = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
        const timeSpent = Math.round((Date.now() - new Date(attempt.started_at).getTime()) / 1000);

        await conn.execute(
            `UPDATE latihan_attempts
             SET status = 'submitted', finished_at = NOW(),
                 total_correct = ?, total_wrong = ?, total_score = ?, time_spent_seconds = ?
             WHERE id = ?`,
            [totalCorrect, totalWrong, totalScore, timeSpent, attemptId]
        );

        await conn.commit();
        return { totalCorrect, totalWrong, totalScore, totalMarks, earnedMarks };

    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

async function getAttemptAnswers(attemptId) {
    const [rows] = await pool.execute(
        `SELECT question_id, selected_option_ids, answer_text,
                is_correct, is_flagged, marks_earned, sequence_token, option_order
         FROM latihan_attempt_answers WHERE attempt_id = ?`,
        [attemptId]
    );
    return rows.map(r => ({
        ...r,
        selected_option_ids: typeof r.selected_option_ids === 'string'
            ? JSON.parse(r.selected_option_ids) : (r.selected_option_ids || []),
        option_order: typeof r.option_order === 'string'
            ? JSON.parse(r.option_order) : (r.option_order || null)
    }));
}

async function getAttemptQuestionOrder(attemptId) {
    const [rows] = await pool.execute(
        `SELECT question_id FROM latihan_attempt_questions
         WHERE attempt_id = ? ORDER BY sort_order ASC`,
        [attemptId]
    );
    return rows.map(r => r.question_id);
}

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

    const [questions] = await pool.execute(`
        SELECT q.id, q.type, q.content, q.explanation, q.difficulty,
               laq.sort_order, lpq.marks,
               laa.selected_option_ids, laa.answer_text,
               laa.is_correct, laa.is_flagged, laa.marks_earned
        FROM latihan_attempt_questions laq
        JOIN questions q ON q.id = laq.question_id
        JOIN latihan_paket_questions lpq ON lpq.paket_id = ? AND lpq.question_id = q.id
        LEFT JOIN latihan_attempt_answers laa ON laa.attempt_id = ? AND laa.question_id = q.id
        WHERE laq.attempt_id = ?
        ORDER BY laq.sort_order ASC
    `, [attempt.paket_id, attemptId, attemptId]);

    if (questions.length > 0) {
        const qIds = questions.map(q => q.id);
        const ph = qIds.map(() => '?').join(',');
        const [options] = await pool.execute(
            `SELECT id, question_id, content, is_correct, sort_order
             FROM question_options WHERE question_id IN (${ph}) ORDER BY sort_order ASC`,
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
                ? JSON.parse(q.selected_option_ids) : (q.selected_option_ids || []);
        });
    }
    return { attempt, questions };
}

async function getRiwayatSiswa(userId, limit = 20) {
    const [rows] = await pool.execute(`
        SELECT la.*, lp.name AS paket_name, c.name AS category_name, c.code AS category_code
        FROM latihan_attempts la
        JOIN latihan_paket lp ON lp.id = la.paket_id
        LEFT JOIN categories c ON c.id = lp.category_id
        WHERE la.user_id = ? AND la.status = 'submitted'
        ORDER BY la.finished_at DESC
        LIMIT ?`, [userId, limit]
    );
    return rows;
}

module.exports = {
    startAttempt, saveAnswer, submitAttempt,
    getAttemptAnswers, getAttemptQuestionOrder,
    getAttemptResult, getRiwayatSiswa
};
