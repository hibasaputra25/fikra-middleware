const express = require('express');
const router  = express.Router();
const {
    register, login, refreshAccessToken,
    logout, getMe, updateProfile, changePassword,
    verifyEmail, resendVerification,
    forgotPassword, resetPassword
} = require('../services/authService');
const { authMiddleware } = require('../middleware/auth');

// =====================================================================
// POST /api/auth/register
// =====================================================================
router.post('/register', async (req, res, next) => {
    try {
        const { username, email, password, nama, role } = req.body;
        const result = await register({ username, email, password, nama, role });
        res.status(201).json(result);
    } catch (err) {
        const userErrors = [
            'wajib diisi', 'minimal', 'sudah terdaftar',
            'tidak valid', 'hanya boleh'
        ];
        if (userErrors.some(e => err.message.includes(e))) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
});

// =====================================================================
// POST /api/auth/login
// =====================================================================
router.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;
        const result = await login({ username, password });
        res.json(result);
    } catch (err) {
        if (err.message.includes('salah') || err.message.includes('wajib')) {
            return res.status(401).json({ error: err.message });
        }
        next(err);
    }
});

// =====================================================================
// POST /api/auth/refresh
// Tukar refresh token dengan access token baru
// =====================================================================
router.post('/refresh', async (req, res, next) => {
    try {
        const { refresh_token } = req.body;
        const result = await refreshAccessToken(refresh_token);
        res.json(result);
    } catch (err) {
        if (err.message.includes('tidak valid') || err.message.includes('expired')) {
            return res.status(401).json({ error: err.message, code: 'REFRESH_INVALID' });
        }
        next(err);
    }
});

// =====================================================================
// POST /api/auth/logout
// =====================================================================
router.post('/logout', async (req, res, next) => {
    try {
        const { refresh_token } = req.body;
        await logout(refresh_token);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// GET /api/auth/me
// =====================================================================
router.get('/me', authMiddleware, async (req, res, next) => {
    try {
        const user = await getMe(req.user.id);
        res.json(user);
    } catch (err) {
        if (err.message.includes('tidak ditemukan')) {
            return res.status(404).json({ error: err.message });
        }
        next(err);
    }
});

// =====================================================================
// PUT /api/auth/profile
// =====================================================================
router.put('/profile', authMiddleware, async (req, res, next) => {
    try {
        const { nama, email, foto_url } = req.body;
        const user = await updateProfile(req.user.id, { nama, email, foto_url });
        res.json(user);
    } catch (err) {
        if (err.message.includes('tidak ada')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
});

// =====================================================================
// PUT /api/auth/admin/reset-password/:userId
// Admin reset password user lain
router.put('/admin/reset-password/:userId', async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token tidak ditemukan' });
    try {
        const { verifyAccessToken } = require('../services/authService');
        const payload = verifyAccessToken(authHeader.split(' ')[1]);
        if (payload.role !== 'admin') return res.status(403).json({ error: 'Hanya admin yang bisa reset password' });
    } catch {
        return res.status(401).json({ error: 'Token tidak valid' });
    }

    try {
        const userId = parseInt(req.params.userId);
        const { new_password } = req.body;
        if (!new_password || new_password.length < 8) {
            return res.status(400).json({ error: 'Password minimal 8 karakter' });
        }

        const bcrypt = require('bcryptjs');
        const { pool } = require('../config/db');
        const newHash = await bcrypt.hash(new_password, 12);
        const [result] = await pool.execute(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [newHash, userId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }
        // Hapus semua refresh token user ini (force re-login)
        await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
        res.json({ success: true, message: 'Password berhasil direset' });
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// GET /api/auth/verify-email?token=xxx
// =====================================================================
router.get('/verify-email', async (req, res, next) => {
    try {
        const { token } = req.query;
        const result = await verifyEmail(token);
        res.json(result);
    } catch (err) {
        const userErrors = ['tidak ditemukan', 'tidak valid', 'kadaluarsa'];
        if (userErrors.some(e => err.message.includes(e))) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
});

// =====================================================================
// POST /api/auth/resend-verification
// =====================================================================
router.post('/resend-verification', async (req, res, next) => {
    try {
        const { email } = req.body;
        const result = await resendVerification(email);
        res.json(result);
    } catch (err) {
        const userErrors = ['wajib', 'tidak terdaftar', 'sudah terverifikasi'];
        if (userErrors.some(e => err.message.includes(e))) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
});

// PUT /api/auth/change-password
// =====================================================================
router.put('/change-password', authMiddleware, async (req, res, next) => {
    try {
        const { old_password, new_password } = req.body;
        await changePassword(req.user.id, {
            oldPassword: old_password,
            newPassword: new_password
        });
        res.json({ success: true, message: 'Password berhasil diubah' });
    } catch (err) {
        const userErrors = ['salah', 'wajib', 'minimal'];
        if (userErrors.some(e => err.message.includes(e))) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
});

// =====================================================================
// POST /api/auth/forgot-password
// =====================================================================
router.post('/forgot-password', async (req, res, next) => {
    try {
        const { email } = req.body;
        const result = await forgotPassword({ email });
        res.json(result);
    } catch (err) {
        if (err.message.includes('wajib')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
});

// =====================================================================
// POST /api/auth/reset-password
// =====================================================================
router.post('/reset-password', async (req, res, next) => {
    try {
        const { token, new_password } = req.body;
        const result = await resetPassword({ token, new_password });
        res.json(result);
    } catch (err) {
        const userErrors = ['wajib', 'minimal', 'tidak valid', 'kadaluarsa'];
        if (userErrors.some(e => err.message.includes(e))) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
});

module.exports = router;
