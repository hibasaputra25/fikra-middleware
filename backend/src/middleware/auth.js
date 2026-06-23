const { loginSiswa } = require('../config/moodle');
const { panggilAPI } = require('../config/moodle');

// Middleware verifikasi token siswa
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token tidak ditemukan' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Verifikasi token ke Moodle
        const siteInfo = await panggilAPIWithToken(token, 'core_webservice_get_site_info', {});

        // Ambil role dari Moodle
        const { getRoleUser } = require('../config/moodle');
        const role = await getRoleUser(siteInfo.userid);

        req.user = {
            id: siteInfo.userid,
            username: siteInfo.username,
            nama: siteInfo.fullname,
            role,
            token
        };
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token tidak valid atau sudah expired' });
    }
}

// Panggil Moodle API dengan token spesifik (bukan admin token)
async function panggilAPIWithToken(token, fungsi, parameter = {}) {
    const axios = require('axios');
    const response = await axios.get(process.env.MOODLE_URL, {
        params: {
            wstoken: token,
            wsfunction: fungsi,
            moodlewsrestformat: 'json',
            ...parameter
        },
        timeout: 10000
    });

    if (response.data && response.data.exception) {
        throw new Error(response.data.message);
    }

    return response.data;
}

module.exports = { authMiddleware };