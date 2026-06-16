const axios = require('axios');

const MOODLE_URL = process.env.MOODLE_URL;
const MOODLE_TOKEN = process.env.MOODLE_TOKEN;

async function panggilAPI(fungsi, parameter = {}) {
    try {
        const response = await axios.get(MOODLE_URL, {
            params: {
                wstoken: MOODLE_TOKEN,
                wsfunction: fungsi,
                moodlewsrestformat: 'json',
                ...parameter
            },
            timeout: 30000
        });

        if (response.data && response.data.exception) {
            throw new Error(`Moodle API Error: ${response.data.message}`);
        }

        return response.data;
    } catch (err) {
        if (err.message.startsWith('Moodle API Error')) throw err;
        throw new Error(`Network Error: ${err.message}`);
    }
}

// Panggil API Moodle menggunakan token user tertentu
async function panggilAPIAsUser(userToken, fungsi, parameter = {}) {
    try {
        const response = await axios.get(MOODLE_URL, {
            params: {
                wstoken: userToken,
                wsfunction: fungsi,
                moodlewsrestformat: 'json',
                ...parameter
            },
            timeout: 30000
        });

        if (response.data && response.data.exception) {
            throw new Error(`Moodle API Error: ${response.data.message}`);
        }

        return response.data;
    } catch (err) {
        if (err.message.startsWith('Moodle API Error')) throw err;
        throw new Error(`Network Error: ${err.message}`);
    }
}

// Ambil atau generate token Moodle untuk user tertentu
async function getUserToken(username) {
    const pluginUrl = process.env.MOODLE_URL.replace('/webservice/rest/server.php', '/local/fikra_auth/token.php');
    const secret = process.env.FIKRA_MOODLE_SECRET || 'fikra-secret-change-this';

    try {
        const response = await axios.get(pluginUrl, {
            params: { username, secret },
            timeout: 10000
        });

        if (response.data.error) {
            throw new Error(response.data.error);
        }

        return response.data;
    } catch (err) {
        if (err.response?.data?.error) {
            throw new Error(`Token Error: ${err.response.data.error}`);
        }
        throw new Error(`Network Error: ${err.message}`);
    }
}

// Login siswa via Moodle dan dapatkan token
async function loginSiswa(username, password) {
    const loginUrl = process.env.MOODLE_URL.replace('/webservice/rest/server.php', '/login/token.php');
    const response = await axios.get(loginUrl, {
        params: { username, password, service: 'moodle_mobile_app' },
        timeout: 10000
    });

    if (response.data.error) {
        throw new Error(response.data.error);
    }

    return response.data.token;
}

// Tentukan role aplikasi berdasarkan role Moodle di course
async function getRoleUser(userId) {
    try {
        const courseId = process.env.MOODLE_COURSE_ID || 2;

        const response = await axios.get(MOODLE_URL, {
            params: {
                wstoken: MOODLE_TOKEN,
                wsfunction: 'core_enrol_get_enrolled_users',
                moodlewsrestformat: 'json',
                courseid: courseId
            },
            timeout: 15000
        });

        if (!Array.isArray(response.data)) return 'siswa';

        const user = response.data.find(u => u.id === userId);
        if (!user || !user.roles) return 'siswa';

        const roleShortnames = user.roles.map(r => r.shortname);

        if (roleShortnames.includes('manager') || roleShortnames.includes('coursecreator')) {
            return 'admin';
        }
        if (roleShortnames.includes('editingteacher') || roleShortnames.includes('teacher')) {
            return 'guru';
        }
        return 'siswa';
    } catch (err) {
        console.warn('⚠️ Gagal ambil role user:', err.message);
        return 'siswa';
    }
}

module.exports = { panggilAPI, panggilAPIAsUser, getUserToken, loginSiswa, getRoleUser };
