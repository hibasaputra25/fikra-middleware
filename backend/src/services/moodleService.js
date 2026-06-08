const { panggilAPI } = require('../config/moodle');
const { hitungNilaiPerSubtes } = require('../config/mapping');

const COURSE_ID = process.env.MOODLE_COURSE_ID || 2;

// Cache sederhana in-memory
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 menit

function getCache(key) {
    const item = cache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > CACHE_TTL) {
        cache.delete(key);
        return null;
    }
    return item.data;
}

function setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}

// GET semua quiz di course
async function getQuizzes() {
    const cacheKey = `quizzes_${COURSE_ID}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const data = await panggilAPI('mod_quiz_get_quizzes_by_courses', {
        'courseids[0]': COURSE_ID
    });

    const quizzes = (data.quizzes || []).map(q => ({
        id: q.id,
        nama: q.name,
        waktu_buka: q.timeopen ? new Date(q.timeopen * 1000).toISOString() : null,
        waktu_tutup: q.timeclose ? new Date(q.timeclose * 1000).toISOString() : null,
        durasi_menit: q.timelimit ? Math.round(q.timelimit / 60) : null,
        total_soal: q.sumgrades,
        status: getStatusQuiz(q)
    }));

    setCache(cacheKey, quizzes);
    return quizzes;
}

function getStatusQuiz(quiz) {
    const now = Math.floor(Date.now() / 1000);
    if (quiz.timeopen && now < quiz.timeopen) return 'upcoming';
    if (quiz.timeclose && now > quiz.timeclose) return 'closed';
    return 'open';
}

// GET semua siswa di course
async function getSiswa() {
    const cacheKey = `students_${COURSE_ID}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const data = await panggilAPI('core_enrol_get_enrolled_users', {
        courseid: COURSE_ID
    });

    const siswa = (data || []).filter(u =>
        u.roles && u.roles.some(r => r.shortname === 'student')
    ).map(u => ({
        id: u.id,
        username: u.username,
        nama: u.fullname,
        email: u.email,
        idnumber: u.idnumber || null,
        last_access: u.lastaccess ? new Date(u.lastaccess * 1000).toISOString() : null
    }));

    setCache(cacheKey, siswa);
    return siswa;
}

// GET hasil tryout siswa per quiz
async function getHasilSiswa(userId, quizId) {
    // Ambil semua attempt siswa
    const res = await panggilAPI('mod_quiz_get_user_attempts', {
        quizid: quizId,
        userid: userId,
        status: 'finished'
    });

    if (!res.attempts || res.attempts.length === 0) {
        return null;
    }

    // Ambil attempt terakhir
    const attempt = res.attempts[res.attempts.length - 1];

    // Ambil review attempt
    const review = await panggilAPI('mod_quiz_get_attempt_review', {
        attemptid: attempt.id,
        page: -1
    });

    if (!review.questions) {
        throw new Error('Gagal mengambil data soal dari attempt');
    }

    // Hitung nilai per subtes
    const nilaiPerSubtes = hitungNilaiPerSubtes(review.questions, quizId);

    return {
        attempt_id: attempt.id,
        attempt_ke: attempt.attempt,
        waktu_mulai: new Date(attempt.timestart * 1000).toISOString(),
        waktu_selesai: new Date(attempt.timefinish * 1000).toISOString(),
        durasi_menit: Math.round((attempt.timefinish - attempt.timestart) / 60),
        ...nilaiPerSubtes
    };
}

// GET semua attempt siswa di semua quiz
async function getRiwayatSiswa(userId) {
    const quizzes = await getQuizzes();
    const riwayat = [];

    for (const quiz of quizzes) {
        try {
            const hasil = await getHasilSiswa(userId, quiz.id);
            if (hasil) {
                riwayat.push({
                    quiz_id: quiz.id,
                    quiz_nama: quiz.nama,
                    ...hasil
                });
            }
        } catch (err) {
            // Skip quiz yang error (misal belum ada mapping)
            console.warn(`⚠️ Skip quiz ${quiz.id}: ${err.message}`);
        }
    }

    return riwayat;
}

module.exports = { getQuizzes, getSiswa, getHasilSiswa, getRiwayatSiswa };