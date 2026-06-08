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

module.exports = { panggilAPI, loginSiswa };