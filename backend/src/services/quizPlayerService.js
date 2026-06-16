const { panggilAPIAsUser, getUserToken } = require('../config/moodle');

/**
 * Ambil akses info quiz — cek apakah user bisa attempt
 */
async function getQuizAccess(userToken, quizId) {
    const data = await panggilAPIAsUser(userToken, 'mod_quiz_get_quiz_access_information', {
        quizid: quizId
    });
    return data;
}

/**
 * Mulai attempt baru atau lanjutkan attempt yang belum selesai
 */
async function startAttempt(userToken, quizId) {
    // Cek dulu apakah ada attempt yang masih belum selesai (unfinished)
    const attemptsData = await panggilAPIAsUser(userToken, 'mod_quiz_get_user_attempts', {
        quizid: quizId,
        status: 'unfinished'
    });

    // Jika ada attempt unfinished, lanjutkan
    if (attemptsData.attempts && attemptsData.attempts.length > 0) {
        const existing = attemptsData.attempts[attemptsData.attempts.length - 1];
        return {
            attempt_id: existing.id,
            attempt_ke: existing.attempt,
            timestart: existing.timestart,
            is_new: false
        };
    }

    // Mulai attempt baru
    const data = await panggilAPIAsUser(userToken, 'mod_quiz_start_attempt', {
        quizid: quizId
    });

    if (!data.attempt) {
        throw new Error('Gagal memulai attempt');
    }

    return {
        attempt_id: data.attempt.id,
        attempt_ke: data.attempt.attempt,
        timestart: data.attempt.timestart,
        is_new: true
    };
}

/**
 * Ambil data soal untuk halaman tertentu
 * page = -1 untuk semua soal sekaligus
 */
async function getAttemptData(userToken, attemptId, page = 0) {
    const data = await panggilAPIAsUser(userToken, 'mod_quiz_get_attempt_data', {
        attemptid: attemptId,
        page
    });

    if (!data.questions) {
        throw new Error('Gagal mengambil data soal');
    }

    // Proses setiap soal — ekstrak info penting
    const questions = data.questions.map(q => ({
        slot: q.slot,
        type: q.type,
        page: q.page,
        html: q.html,                    // HTML render dari Moodle
        sequencecheck: q.sequencecheck,  // Token validasi untuk submit
        flagged: q.flagged || false,
        state: q.state || null,
        status: q.status || null,
        blockedbyprevious: q.blockedbyprevious || false,
        number: q.number,
    }));

    return {
        attempt_id: attemptId,
        attempt: data.attempt,
        messages: data.messages || [],
        next_page: data.nextpage,
        questions
    };
}

/**
 * Auto-save jawaban selama attempt berlangsung
 * data = array of { name, value } sesuai format Moodle
 */
async function saveAttempt(userToken, attemptId, data) {
    // Format data untuk Moodle API
    const params = { attemptid: attemptId, finishattempt: 0 };
    data.forEach((item, index) => {
        params[`data[${index}][name]`] = item.name;
        params[`data[${index}][value]`] = item.value;
    });

    const result = await panggilAPIAsUser(userToken, 'mod_quiz_save_attempt', params);
    return { success: result.status === true };
}

/**
 * Submit attempt (selesaikan tryout)
 */
async function submitAttempt(userToken, attemptId, data = []) {
    const params = { attemptid: attemptId, finishattempt: 1 };
    data.forEach((item, index) => {
        params[`data[${index}][name]`] = item.name;
        params[`data[${index}][value]`] = item.value;
    });

    const result = await panggilAPIAsUser(userToken, 'mod_quiz_process_attempt', params);
    return { success: true, state: result.state };
}

/**
 * Ambil summary attempt (daftar semua soal dan statusnya)
 * Dipakai untuk halaman review sebelum submit
 */
async function getAttemptSummary(userToken, attemptId) {
    const data = await panggilAPIAsUser(userToken, 'mod_quiz_get_attempt_summary', {
        attemptid: attemptId
    });

    return {
        questions: (data.questions || []).map(q => ({
            slot: q.slot,
            type: q.type,
            page: q.page,
            flagged: q.flagged || false,
            state: q.state,
            status: q.status,
            number: q.number,
            mark: q.mark,
            maxmark: q.maxmark,
        }))
    };
}

/**
 * Ambil token Moodle user berdasarkan username
 */
async function getMoodleToken(username) {
    return await getUserToken(username);
}

module.exports = {
    getQuizAccess,
    startAttempt,
    getAttemptData,
    saveAttempt,
    submitAttempt,
    getAttemptSummary,
    getMoodleToken
};
