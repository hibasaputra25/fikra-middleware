const express = require('express');
const router = express.Router();
const { loginSiswa, getRoleUser } = require('../config/moodle');
const axios = require('axios');

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username dan password wajib diisi' });
        }

        const token = await loginSiswa(username, password);

        // Ambil info user dari Moodle
        const siteInfo = await axios.get(process.env.MOODLE_URL, {
            params: {
                wstoken: token,
                wsfunction: 'core_webservice_get_site_info',
                moodlewsrestformat: 'json'
            }
        });

        const user = siteInfo.data;

        // Tentukan role berdasarkan role Moodle di course
        const role = await getRoleUser(user.userid, token);

        res.json({
            token,
            user: {
                id: user.userid,
                username: user.username,
                nama: user.fullname,
                foto: user.userpictureurl,
                role
            }
        });
    } catch (err) {
        if (err.message.includes('Invalid login')) {
            return res.status(401).json({ error: 'Username atau password salah' });
        }
        next(err);
    }
});

// GET /api/auth/me
router.get('/me', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token tidak ditemukan' });
        }

        const token = authHeader.split(' ')[1];
        const response = await axios.get(process.env.MOODLE_URL, {
            params: {
                wstoken: token,
                wsfunction: 'core_webservice_get_site_info',
                moodlewsrestformat: 'json'
            }
        });

        if (response.data.exception) {
            return res.status(401).json({ error: 'Token tidak valid' });
        }

        const user = response.data;

        // Tentukan role berdasarkan role Moodle di course
        const role = await getRoleUser(user.userid, token);

        res.json({
            id: user.userid,
            username: user.username,
            nama: user.fullname,
            foto: user.userpictureurl,
            role
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;