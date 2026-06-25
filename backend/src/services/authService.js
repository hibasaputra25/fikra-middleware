const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const { pool }  = require('../config/db');
const { sendVerificationEmail } = require('./emailService');

const JWT_SECRET          = process.env.JWT_SECRET  || process.env.APP_SECRET || 'fikra-jwt-secret';
const JWT_EXPIRES_IN      = process.env.JWT_EXPIRES  || '7d';
const REFRESH_EXPIRES_IN  = 30; // hari
const BCRYPT_ROUNDS       = 12;

// =====================================================================
// HELPERS
// =====================================================================

function signAccessToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyAccessToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

function hashRefreshToken(raw) {
    return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateRefreshToken() {
    return crypto.randomBytes(48).toString('hex');
}

// =====================================================================
// REGISTER
// =====================================================================

async function register({ username, email, password, nama, role = 'siswa', invite_code = null }) {
    // Validasi input
    if (!username || !email || !password || !nama) {
        throw new Error('username, email, password, dan nama wajib diisi');
    }
    if (password.length < 8) {
        throw new Error('Password minimal 8 karakter');
    }
    if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
        throw new Error('Username hanya boleh huruf, angka, titik, dan underscore');
    }
    // Public register hanya boleh role siswa
    if (!['siswa', 'guru', 'admin'].includes(role)) {
        throw new Error('Role tidak valid');
    }

    // Cek duplikasi
    const [[existing]] = await pool.execute(
        'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
        [username, email]
    );
    if (existing) throw new Error('Username atau email sudah terdaftar');

    // Validasi invite_code jika ada
    let inviteRow = null;
    let userType = 'subscription'; // default: daftar mandiri
    if (invite_code) {
        const [[ic]] = await pool.execute(
            `SELECT * FROM invite_codes
             WHERE code = ? AND is_active = 1
               AND (expires_at IS NULL OR expires_at > NOW())
               AND used_count < max_uses
             LIMIT 1`,
            [invite_code]
        );
        if (!ic) throw new Error('Kode undangan tidak valid atau sudah kadaluarsa');
        inviteRow = ic;
        userType = 'kelas';
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const [result] = await pool.execute(
        `INSERT INTO users (username, email, password_hash, nama, role, user_type, is_email_verified)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [username, email, password_hash, nama, role, userType]
    );
    const userId = result.insertId;

    // Jika dari invite code: relasi guru_siswa + user_jenjang + increment used_count
    if (inviteRow) {
        await pool.execute(
            'INSERT INTO guru_siswa (guru_id, siswa_id) VALUES (?, ?)',
            [inviteRow.created_by, userId]
        );
        if (inviteRow.kurikulum_id) {
            await pool.execute(
                'INSERT IGNORE INTO user_jenjang (user_id, kurikulum_id) VALUES (?, ?)',
                [userId, inviteRow.kurikulum_id]
            );
        }
        await pool.execute(
            'UPDATE invite_codes SET used_count = used_count + 1 WHERE id = ?',
            [inviteRow.id]
        );
    }

    // Insert subscription free
    await pool.execute(
        `INSERT INTO subscriptions (user_id, plan, status) VALUES (?, 'free', 'active')`,
        [userId]
    );

    // Generate & kirim email verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const expiresAt   = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 19).replace('T', ' ');
    await pool.execute(
        'INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)',
        [userId, verifyToken, expiresAt]
    );

    const user = await getUserById(userId);

    // Kirim email (non-blocking — jangan gagalkan register kalau email error)
    sendVerificationEmail(user, verifyToken).catch(err =>
        console.warn('⚠️  Gagal kirim email verifikasi:', err.message)
    );

    return {
        user: safeUser(user),
        message: 'Registrasi berhasil! Cek email kamu untuk verifikasi akun.',
        email_sent: true
    };
}

// =====================================================================
// VERIFY EMAIL
// =====================================================================

async function verifyEmail(token) {
    if (!token) throw new Error('Token tidak ditemukan');

    const [[ev]] = await pool.execute(
        `SELECT * FROM email_verifications
         WHERE token = ? AND used_at IS NULL AND expires_at > NOW()
         LIMIT 1`,
        [token]
    );
    if (!ev) throw new Error('Token tidak valid atau sudah kadaluarsa');

    // Tandai token sebagai used
    await pool.execute(
        'UPDATE email_verifications SET used_at = NOW() WHERE id = ?',
        [ev.id]
    );

    // Aktifkan user
    await pool.execute(
        'UPDATE users SET is_email_verified = 1, email_verified_at = NOW() WHERE id = ?',
        [ev.user_id]
    );

    const user = await getUserById(ev.user_id);
    const { accessToken, refreshToken } = await issueTokens(user);

    return { user: safeUser(user), accessToken, refreshToken };
}

// =====================================================================
// RESEND VERIFICATION
// =====================================================================

async function resendVerification(email) {
    if (!email) throw new Error('Email wajib diisi');

    const [[user]] = await pool.execute(
        'SELECT * FROM users WHERE email = ? AND is_active = 1 LIMIT 1',
        [email]
    );
    if (!user) throw new Error('Email tidak terdaftar');
    if (user.is_email_verified) throw new Error('Email sudah terverifikasi');

    // Hapus token lama
    await pool.execute(
        'DELETE FROM email_verifications WHERE user_id = ?',
        [user.id]
    );

    // Generate token baru
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const expiresAt   = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 19).replace('T', ' ');
    await pool.execute(
        'INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, verifyToken, expiresAt]
    );

    await sendVerificationEmail(user, verifyToken);

    return { message: 'Email verifikasi telah dikirim ulang' };
}

// =====================================================================
// LOGIN
// =====================================================================

async function login({ username, password }) {
    if (!username || !password) {
        throw new Error('Username dan password wajib diisi');
    }

    // Cari by username atau email
    const [[user]] = await pool.execute(
        'SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1 LIMIT 1',
        [username, username]
    );

    if (!user) throw new Error('Username atau password salah');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new Error('Username atau password salah');

    // Update last_login_at
    await pool.execute(
        'UPDATE users SET last_login_at = NOW() WHERE id = ?',
        [user.id]
    );

    const { accessToken, refreshToken } = await issueTokens(user);

    return { user: safeUser(user), accessToken, refreshToken };
}

// =====================================================================
// REFRESH TOKEN
// =====================================================================

async function refreshAccessToken(rawRefreshToken) {
    if (!rawRefreshToken) throw new Error('Refresh token tidak ditemukan');

    const tokenHash = hashRefreshToken(rawRefreshToken);

    const [[stored]] = await pool.execute(
        `SELECT rt.*, u.id as uid FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         WHERE rt.token_hash = ? AND rt.expires_at > NOW() AND u.is_active = 1`,
        [tokenHash]
    );

    if (!stored) throw new Error('Refresh token tidak valid atau sudah expired');

    const user = await getUserById(stored.user_id);

    // Rotate refresh token (hapus lama, buat baru)
    await pool.execute('DELETE FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
    const { accessToken, refreshToken } = await issueTokens(user);

    return { user: safeUser(user), accessToken, refreshToken };
}

// =====================================================================
// LOGOUT
// =====================================================================

async function logout(rawRefreshToken) {
    if (!rawRefreshToken) return;
    const tokenHash = hashRefreshToken(rawRefreshToken);
    await pool.execute('DELETE FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
}

async function logoutAll(userId) {
    await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
}

// =====================================================================
// GET ME
// =====================================================================

async function getMe(userId) {
    const user = await getUserById(userId);
    if (!user || !user.is_active) throw new Error('User tidak ditemukan');
    return safeUser(user);
}

// =====================================================================
// UPDATE PROFILE
// =====================================================================

async function updateProfile(userId, { nama, email, foto_url }) {
    const fields = [];
    const params = [];

    if (nama)     { fields.push('nama = ?');     params.push(nama); }
    if (email)    { fields.push('email = ?');    params.push(email); }
    if (foto_url) { fields.push('foto_url = ?'); params.push(foto_url); }

    if (fields.length === 0) throw new Error('Tidak ada data yang diupdate');
    params.push(userId);

    await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    return safeUser(await getUserById(userId));
}

// =====================================================================
// CHANGE PASSWORD
// =====================================================================

async function changePassword(userId, { oldPassword, newPassword }) {
    if (!oldPassword || !newPassword) throw new Error('Password lama dan baru wajib diisi');
    if (newPassword.length < 8) throw new Error('Password baru minimal 8 karakter');

    const [[user]] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) throw new Error('User tidak ditemukan');

    const valid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!valid) throw new Error('Password lama salah');

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    // Invalidasi semua refresh token (force re-login di semua device)
    await logoutAll(userId);
}

// =====================================================================
// INTERNAL HELPERS
// =====================================================================

async function issueTokens(user) {
    const payload = {
        sub:  user.id,
        role: user.role,
        nama: user.nama
    };
    const accessToken  = signAccessToken(payload);
    const rawRefresh   = generateRefreshToken();
    const tokenHash    = hashRefreshToken(rawRefresh);
    const expiresAt    = new Date(Date.now() + REFRESH_EXPIRES_IN * 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 19).replace('T', ' ');

    await pool.execute(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [user.id, tokenHash, expiresAt]
    );

    return { accessToken, refreshToken: rawRefresh };
}

async function getUserById(id) {
    const [[user]] = await pool.execute(
        'SELECT * FROM users WHERE id = ? LIMIT 1', [id]
    );
    return user || null;
}

function safeUser(user) {
    if (!user) return null;
    const { password_hash, ...safe } = user;
    return safe;
}

module.exports = {
    register, login, refreshAccessToken,
    logout, logoutAll, getMe,
    updateProfile, changePassword,
    verifyEmail, resendVerification,
    verifyAccessToken, safeUser, getUserById
};
