const { pool } = require('../config/db');
const crypto = require('crypto');

/**
 * Cek apakah user bisa attempt tryout ini
 */
async function getQuizAccess(userId, tryoutId) {
    const [[tryout]] = await pool.execute(
        `SELECT id, title, time_limit_minutes, max_attempts, is_active, start_time, end_time
         FROM tryouts WHERE id = ? LIMIT 1`,
        [tryoutId]
    );

    if (!tryout) throw new Error('Tryout tidak ditemukan');
    if (!tryout.is_active) {
        return { can_attempt: false, reason: 'Tryout tidak aktif' };
    }

    const now = new Date();
    if (tryout.start_time && new Date(tryout.start_time) > now) {
        return { can_attempt: false, reason: 'Tryout belum dibuka' };
    }
    if (tryout.end_time && new Date(tryout.end_time) < now) {
        return { can_attempt: false, reason: 'Tryout sudah ditutup' };
    }

    // Cek jumlah attempt yang sudah selesai
    if (tryout.max_attempts) {
        const [[countRow]] = await pool.execute(
            `SELECT COUNT(*) as total FROM tryout_attempts
             WHERE tryout_id = ? AND user_id = ? AND status = 'submitted'`,
            [tryoutId, userId]
        );
        if (countRow.total >= tryout.max_attempts) {
            return { can_attempt: false, reason: `Batas maksimal ${tryout.max_attempts} attempt sudah tercapai` };
        }
    }

    return {
        can_attempt: true,
        tryout_id: tryout.id,
        title: tryout.title,
        time_limit_minutes: tryout.time_limit_minutes,
        end_time: tryout.end_time || null
    };
}

/**
 * Mulai attempt baru atau lanjutkan attempt yang belum selesai
 */
async function startAttempt(userId, tryoutId) {
    // Cek attempt yang masih in_progress
    const [[existing]] = await pool.execute(
        `SELECT id, attempt_number, started_at, due_at
         FROM tryout_attempts
         WHERE tryout_id = ? AND user_id = ? AND status = 'in_progress'
         ORDER BY id DESC LIMIT 1`,
        [tryoutId, userId]
    );

    if (existing) {
        return {
            attempt_id: existing.id,
            attempt_ke: existing.attempt_number,
            timestart: existing.started_at,
            due_at: existing.due_at,
            is_new: false
        };
    }

    // Hitung attempt_number berikutnya
    const [[countRow]] = await pool.execute(
        `SELECT COUNT(*) as total FROM tryout_attempts WHERE tryout_id = ? AND user_id = ?`,
        [tryoutId, userId]
    );
    const attemptNumber = (countRow.total || 0) + 1;

    // Hitung due_at berdasarkan time_limit tryout
    const [[tryout]] = await pool.execute(
        'SELECT time_limit_minutes FROM tryouts WHERE id = ? LIMIT 1',
        [tryoutId]
    );

    const startedAt = new Date();
    let dueAt = null;
    if (tryout?.time_limit_minutes) {
        dueAt = new Date(startedAt.getTime() + tryout.time_limit_minutes * 60 * 1000);
    }

    const [result] = await pool.execute(
        `INSERT INTO tryout_attempts (tryout_id, user_id, attempt_number, status, started_at, due_at)
         VALUES (?, ?, ?, 'in_progress', NOW(), IF(? IS NULL, NULL, DATE_ADD(NOW(), INTERVAL ? MINUTE)))`,
        [tryoutId, userId, attemptNumber, tryout?.time_limit_minutes || null, tryout?.time_limit_minutes || null]
    );

    return {
        attempt_id: result.insertId,
        attempt_ke: attemptNumber,
        timestart: startedAt,
        due_at: dueAt,
        is_new: true
    };
}

/**
 * Ambil soal untuk attempt — per section atau semua sekaligus (page = -1)
 */
async function getAttemptData(userId, attemptId, page = 0) {
    // Validasi attempt milik user ini
    const [[attempt]] = await pool.execute(
        `SELECT a.*, t.time_limit_minutes
         FROM tryout_attempts a
         JOIN tryouts t ON t.id = a.tryout_id
         WHERE a.id = ? AND a.user_id = ?  LIMIT 1`,
        [attemptId, userId]
    );
    if (!attempt) throw new Error('Attempt tidak ditemukan');
    if (attempt.status === 'submitted') throw new Error('Attempt sudah selesai');

    // Cek waktu habis
    if (attempt.due_at && new Date(attempt.due_at) < new Date()) {
        await pool.execute(
            `UPDATE tryout_attempts SET status = 'expired' WHERE id = ?`,
            [attemptId]
        );
        throw new Error('Waktu pengerjaan sudah habis');
    }

    // Ambil sections
    let sectionQuery = `SELECT id, title, subtes_code, question_count, time_limit_minutes, sort_order
                        FROM tryout_sections WHERE tryout_id = ? ORDER BY sort_order`;
    const [sections] = await pool.execute(sectionQuery, [attempt.tryout_id]);

    // Tentukan section yang aktif (berdasarkan page = index section, -1 = semua)
    const targetSections = page === -1 ? sections : [sections[page]].filter(Boolean);

    const result = [];
    for (const section of targetSections) {
        // Ambil soal + opsi untuk section ini
        const [questions] = await pool.execute(
            `SELECT q.id, q.type, q.content, q.content_image_url, q.explanation,
                    q.difficulty, q.sort_order,
                    tsq.marks, tsq.sort_order as section_sort_order
             FROM tryout_section_questions tsq
             JOIN questions q ON q.id = tsq.question_id
             WHERE tsq.section_id = ?
             ORDER BY tsq.sort_order`,
            [section.id]
        );

        // Ambil semua opsi untuk soal-soal ini sekaligus
        const questionIds = questions.map(q => q.id);
        let optionsMap = {};
        if (questionIds.length > 0) {
            const placeholders = questionIds.map(() => '?').join(',');
            const [options] = await pool.execute(
                `SELECT id, question_id, label, content, content_image_url, sort_order
                 FROM question_options WHERE question_id IN (${placeholders}) ORDER BY sort_order`,
                questionIds
            );
            options.forEach(o => {
                if (!optionsMap[o.question_id]) optionsMap[o.question_id] = [];
                optionsMap[o.question_id].push(o);
            });
        }

        // Ambil jawaban siswa yang sudah diisi untuk attempt ini
        let answersMap = {};
        if (questionIds.length > 0) {
            const placeholders = questionIds.map(() => '?').join(',');
            const [answers] = await pool.execute(
                `SELECT question_id, answer, is_flagged
                 FROM tryout_attempt_answers
                 WHERE attempt_id = ? AND question_id IN (${placeholders})`,
                [attemptId, ...questionIds]
            );
            answers.forEach(a => { answersMap[a.question_id] = a; });
        }

        // Generate sequence token per soal (anti-replay)
        const processedQuestions = questions.map(q => ({
            id: q.id,
            type: q.type,
            content: q.content,
            content_image_url: q.content_image_url || null,
            difficulty: q.difficulty,
            marks: q.marks,
            sort_order: q.section_sort_order,
            options: (optionsMap[q.id] || []).map(o => ({
                id: o.id,
                label: o.label,
                content: o.content,
                content_image_url: o.content_image_url || null
            })),
            saved_answer: answersMap[q.id]?.answer || null,
            is_flagged: answersMap[q.id]?.is_flagged || false,
            sequence_token: crypto
                .createHash('sha256')
                .update(`${attemptId}-${q.id}-${process.env.JWT_SECRET || 'fikra'}`)
                .digest('hex')
                .slice(0, 16)
        }));

        result.push({
            section_id: section.id,
            title: section.title,
            subtes_code: section.subtes_code,
            time_limit_minutes: section.time_limit_minutes,
            sort_order: section.sort_order,
            questions: processedQuestions
        });
    }

    return {
        attempt_id: attemptId,
        attempt: {
            id: attempt.id,
            status: attempt.status,
            started_at: attempt.started_at,
            due_at: attempt.due_at
        },
        sections: result,
        total_sections: sections.length
    };
}

/**
 * Simpan jawaban siswa (auto-save saat mengerjakan)
 */
async function saveAttempt(userId, attemptId, answers) {
    // Validasi attempt
    const [[attempt]] = await pool.execute(
        `SELECT id, status FROM tryout_attempts WHERE id = ? AND user_id = ? LIMIT 1`,
        [attemptId, userId]
    );
    if (!attempt) throw new Error('Attempt tidak ditemukan');
    if (attempt.status !== 'in_progress') throw new Error('Attempt sudah tidak aktif');

    // Upsert setiap jawaban
    for (const ans of answers) {
        const { question_id, answer, is_flagged = false, section_id, time_spent_seconds = 0 } = ans;
        if (!question_id || !section_id) continue;

        await pool.execute(
            `INSERT INTO tryout_attempt_answers
                (attempt_id, section_id, question_id, answer, is_flagged, time_spent_seconds, answered_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
                answer = VALUES(answer),
                is_flagged = VALUES(is_flagged),
                time_spent_seconds = VALUES(time_spent_seconds),
                answered_at = NOW()`,
            [attemptId, section_id, question_id,
             answer != null ? JSON.stringify(answer) : null,
             is_flagged ? 1 : 0,
             time_spent_seconds]
        );
    }

    return { saved: answers.length };
}

/**
 * Ringkasan attempt sebelum submit (soal mana yang dijawab/belum)
 */
async function getAttemptSummary(userId, attemptId) {
    const [[attempt]] = await pool.execute(
        `SELECT a.id, a.status, a.tryout_id FROM tryout_attempts a
         WHERE a.id = ? AND a.user_id = ? LIMIT 1`,
        [attemptId, userId]
    );
    if (!attempt) throw new Error('Attempt tidak ditemukan');

    const [sections] = await pool.execute(
        `SELECT s.id, s.title, s.subtes_code, s.question_count, s.sort_order,
                COUNT(tsq.question_id) as total_questions,
                SUM(CASE WHEN taa.answer IS NOT NULL THEN 1 ELSE 0 END) as answered,
                SUM(CASE WHEN taa.is_flagged = 1 THEN 1 ELSE 0 END) as flagged
         FROM tryout_sections s
         LEFT JOIN tryout_section_questions tsq ON tsq.section_id = s.id
         LEFT JOIN tryout_attempt_answers taa ON taa.question_id = tsq.question_id AND taa.attempt_id = ?
         WHERE s.tryout_id = ?
         GROUP BY s.id ORDER BY s.sort_order`,
        [attemptId, attempt.tryout_id]
    );

    return { attempt_id: attemptId, sections };
}

/**
 * Submit attempt — hitung skor, simpan hasil
 */
async function submitAttempt(userId, attemptId) {
    const [[attempt]] = await pool.execute(
        `SELECT a.*, t.title as tryout_title
         FROM tryout_attempts a
         JOIN tryouts t ON t.id = a.tryout_id
         WHERE a.id = ? AND a.user_id = ? LIMIT 1`,
        [attemptId, userId]
    );
    if (!attempt) throw new Error('Attempt tidak ditemukan');
    if (attempt.status === 'submitted') throw new Error('Attempt sudah disubmit');

    // Ambil SEMUA soal di tryout (termasuk yang tidak dijawab) + jawaban jika ada
    // Penting: totalPossible harus berdasarkan semua soal, bukan hanya yang dijawab
    const [allQuestions] = await pool.execute(
        `SELECT tsq.question_id, tsq.section_id, tsq.marks,
                taa.answer, taa.time_spent_seconds,
                qa.correct_options, qa.correct_text
         FROM tryout_sections ts
         JOIN tryout_section_questions tsq ON tsq.section_id = ts.id
         LEFT JOIN tryout_attempt_answers taa
               ON taa.question_id = tsq.question_id AND taa.attempt_id = ?
         LEFT JOIN question_answers qa ON qa.question_id = tsq.question_id
         WHERE ts.tryout_id = ?`,
        [attemptId, attempt.tryout_id]
    );

    // Hitung skor per section
    const sectionScores = {};
    let totalEarned = 0;
    let totalPossible = 0;

    // Alias ke nama variabel lama agar sisa kode tidak perlu diubah
    const answers = allQuestions;

    for (const ans of answers) {
        const sectionId = ans.section_id;
        if (!sectionScores[sectionId]) {
            sectionScores[sectionId] = { correct: 0, wrong: 0, unanswered: 0, earned: 0, possible: 0 };
        }

        const marks = parseFloat(ans.marks) || 1;
        // totalPossible dihitung dari semua soal, bukan hanya yang dijawab
        totalPossible += marks;
        sectionScores[sectionId].possible += marks;

        if (!ans.answer) {
            sectionScores[sectionId].unanswered++;
            // Update jawaban sebagai unanswered
            await pool.execute(
                `UPDATE tryout_attempt_answers SET is_correct = 0, marks_earned = 0, graded_at = NOW()
                 WHERE attempt_id = ? AND question_id = ?`,
                [attemptId, ans.question_id]
            );
            continue;
        }

        // Cek kebenaran jawaban
        let isCorrect = false;
        const userAnswer = typeof ans.answer === 'string' ? JSON.parse(ans.answer) : ans.answer;
        const correctOptions = ans.correct_options
            ? (typeof ans.correct_options === 'string' ? JSON.parse(ans.correct_options) : ans.correct_options)
            : [];

        if (Array.isArray(userAnswer) && Array.isArray(correctOptions) && correctOptions.length > 0) {
            const userSet = new Set(userAnswer.map(String));
            const correctSet = new Set(correctOptions.map(String));
            isCorrect = userSet.size === correctSet.size &&
                [...userSet].every(v => correctSet.has(v));
        } else if (ans.correct_text && typeof userAnswer === 'string') {
            isCorrect = userAnswer.trim().toLowerCase() === ans.correct_text.trim().toLowerCase();
        }

        const marksEarned = isCorrect ? marks : 0;
        totalEarned += marksEarned;
        sectionScores[sectionId].earned += marksEarned;

        if (isCorrect) sectionScores[sectionId].correct++;
        else sectionScores[sectionId].wrong++;

        await pool.execute(
            `UPDATE tryout_attempt_answers
             SET is_correct = ?, marks_earned = ?, graded_at = NOW()
             WHERE attempt_id = ? AND question_id = ?`,
            [isCorrect ? 1 : 0, marksEarned, attemptId, ans.question_id]
        );
    }

    const totalScore = totalPossible > 0
        ? parseFloat(((totalEarned / totalPossible) * 100).toFixed(2))
        : 0;

    const timeSpent = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
    const toMySQL = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

    await pool.execute(
        `UPDATE tryout_attempts
         SET status = 'submitted', finished_at = ?, time_spent_seconds = ?,
             total_score = ?, score_per_section = ?
         WHERE id = ?`,
        [toMySQL(new Date()), timeSpent, totalScore,
         JSON.stringify(sectionScores), attemptId]
    );

    return {
        attempt_id: attemptId,
        total_score: totalScore,
        score_per_section: sectionScores,
        time_spent_seconds: timeSpent
    };
}

/**
 * Submit attempt dengan transaction + FOR UPDATE (mencegah race condition double-submit).
 * Ini adalah satu-satunya jalur submit yang valid untuk semua player.
 * Menggantikan submitAttempt() yang lama (tanpa transaction).
 */
async function submitAttemptTransactional(userId, attemptId) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[attempt]] = await conn.execute(
            'SELECT * FROM tryout_attempts WHERE id = ? AND user_id = ? FOR UPDATE',
            [attemptId, userId]
        );
        if (!attempt) { await conn.rollback(); throw Object.assign(new Error('Attempt tidak ditemukan'), { status: 404 }); }
        if (attempt.status === 'submitted') { await conn.rollback(); throw Object.assign(new Error('Attempt sudah disubmit'), { status: 409, code: 'ALREADY_SUBMITTED' }); }

        // Grace period 60 detik setelah due_at
        if (attempt.due_at) {
            const deadline = new Date(new Date(attempt.due_at).getTime() + 60_000);
            if (new Date() > deadline) {
                await conn.execute(`UPDATE tryout_attempts SET status = 'expired' WHERE id = ?`, [attemptId]);
                await conn.commit();
                throw Object.assign(new Error('Waktu habis'), { status: 403, code: 'TIME_EXPIRED' });
            }
        }

        // Ambil semua soal tryout (bukan hanya yang dijawab)
        const [questions] = await conn.execute(
            `SELECT tsq.question_id, tsq.section_id, tsq.marks, tsq.penalty, q.type
             FROM tryout_section_questions tsq
             JOIN questions q ON q.id = tsq.question_id
             JOIN tryout_sections ts ON ts.id = tsq.section_id
             WHERE ts.tryout_id = ?`,
            [attempt.tryout_id]
        );

        // Jawaban siswa
        const [rawAnswers] = await conn.execute(
            'SELECT question_id, answer FROM tryout_attempt_answers WHERE attempt_id = ?',
            [attemptId]
        );
        const answerMap = {};
        rawAnswers.forEach(a => {
            const parsed = typeof a.answer === 'string' ? JSON.parse(a.answer) : (a.answer || {});
            answerMap[a.question_id] = parsed;
        });

        // Jawaban benar dari question_options
        const qIds = questions.map(q => q.question_id);
        const ph   = qIds.map(() => '?').join(',');
        const [correctOpts] = qIds.length > 0 ? await conn.execute(
            `SELECT question_id, id FROM question_options WHERE question_id IN (${ph}) AND is_correct = 1`, qIds
        ) : [[]];

        const correctMap = {};
        correctOpts.forEach(o => {
            if (!correctMap[o.question_id]) correctMap[o.question_id] = [];
            correctMap[o.question_id].push(o.id);
        });

        // Hitung skor — totalMarks berdasarkan SEMUA soal
        let totalMarks = 0, earnedMarks = 0;
        const sectionScores = {};

        for (const q of questions) {
            const marks   = parseFloat(q.marks) || 1;
            const penalty = parseFloat(q.penalty) || 0;
            const correct = correctMap[q.question_id] || [];
            const answer  = answerMap[q.question_id] || {};
            const selected = answer.selected_options || [];
            totalMarks += marks;

            const sid = q.section_id;
            if (!sectionScores[sid]) sectionScores[sid] = { correct: 0, total: 0, marks: 0, earned: 0 };
            sectionScores[sid].total++;
            sectionScores[sid].marks += marks;

            let isCorrect = null;
            let earned    = 0;

            if (['mcq_single', 'true_false'].includes(q.type) && selected.length > 0) {
                isCorrect = correct.includes(selected[0]) ? 1 : 0;
                earned    = isCorrect ? marks : -penalty;
            } else if (q.type === 'mcq_multi' && selected.length > 0) {
                const sel = new Set(selected);
                const cor = new Set(correct);
                const allRight  = [...cor].every(id => sel.has(id)) && [...sel].every(id => cor.has(id));
                const partRight = [...sel].filter(id => cor.has(id)).length > 0 && [...sel].filter(id => !cor.has(id)).length === 0;
                if (allRight)       { isCorrect = 1; earned = marks; }
                else if (partRight) { isCorrect = 0; earned = ([...sel].filter(id => cor.has(id)).length / cor.size) * marks * 0.5; }
                else                { isCorrect = 0; earned = -penalty; }
            }
            // soal tidak dijawab: isCorrect = null, earned = 0

            earnedMarks += earned;
            if (isCorrect === 1) sectionScores[sid].correct++;
            sectionScores[sid].earned += earned;

            await conn.execute(
                `UPDATE tryout_attempt_answers
                 SET is_correct = ?, marks_earned = ?, graded_at = NOW()
                 WHERE attempt_id = ? AND question_id = ?`,
                [isCorrect, earned, attemptId, q.question_id]
            );
        }

        const totalScore = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
        const timeSpent  = Math.round((Date.now() - new Date(attempt.started_at).getTime()) / 1000);

        await conn.execute(
            `UPDATE tryout_attempts
             SET status = 'submitted', finished_at = NOW(),
                 total_score = ?, time_spent_seconds = ?, score_per_section = ?
             WHERE id = ?`,
            [totalScore, timeSpent, JSON.stringify(sectionScores), attemptId]
        );

        await conn.commit();

        return {
            attempt_id:         attemptId,
            total_score:        totalScore,
            score_per_section:  sectionScores,
            time_spent_seconds: timeSpent,
        };
    } catch (err) {
        // Hanya rollback jika belum commit (TIME_EXPIRED sudah commit)
        try { await conn.rollback(); } catch (_) {}
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = {
    getQuizAccess,
    startAttempt,
    getAttemptData,
    saveAttempt,
    getAttemptSummary,
    submitAttempt,              // dipertahankan untuk backward compat — deprecated
    submitAttemptTransactional, // gunakan ini untuk semua submit baru
};
