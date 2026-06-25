const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const { pool } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { sendInviteEmail } = require('../services/emailService');

// =====================================================================
// HELPERS
// =====================================================================

function generateCode(prefix = '') {
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
    return prefix ? `${prefix}-${rand}` : rand;
}

// =====================================================================
// GET /api/invite-codes
// Guru/admin list kode undangan milik mereka
// =====================================================================
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        if (!['guru', 'admin'].includes(role)) {
            return res.status(403).json({ error: 'Hanya guru dan admin yang bisa melihat kode undangan' });
        }

        const whereClause = role === 'admin' ? '' : 'WHERE ic.created_by = ?';
        const params      = role === 'admin' ? [] : [userId];

        const [rows] = await pool.execute(
            `SELECT ic.*,
                    u.nama  AS creator_nama,
                    c.name  AS kurikulum_nama
             FROM invite_codes ic
             JOIN users       u ON u.id = ic.created_by
             LEFT JOIN categories c ON c.id = ic.kurikulum_id
             ${whereClause}
             ORDER BY ic.created_at DESC`,
            params
        );

        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// POST /api/invite-codes
// Guru/admin generate kode baru
// Body: { kurikulum_id?, max_uses?, expires_at?, prefix? }
// =====================================================================
router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        if (!['guru', 'admin'].includes(role)) {
            return res.status(403).json({ error: 'Hanya guru dan admin yang bisa membuat kode undangan' });
        }

        const {
            kurikulum_id = null,
            max_uses     = 1,
            expires_at   = null,
            prefix       = ''
        } = req.body;

        // Generate kode unik (retry jika collision)
        let code;
        let attempt = 0;
        while (attempt < 5) {
            code = generateCode(prefix.toUpperCase().slice(0, 8));
            const [[exists]] = await pool.execute(
                'SELECT id FROM invite_codes WHERE code = ? LIMIT 1', [code]
            );
            if (!exists) break;
            attempt++;
        }

        const expiresAtVal = expires_at
            ? new Date(expires_at).toISOString().slice(0, 19).replace('T', ' ')
            : null;

        const [result] = await pool.execute(
            `INSERT INTO invite_codes (code, created_by, kurikulum_id, max_uses, expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [code, userId, kurikulum_id || null, parseInt(max_uses) || 1, expiresAtVal]
        );

        const [[created]] = await pool.execute(
            `SELECT ic.*, u.nama AS creator_nama, c.name AS kurikulum_nama
             FROM invite_codes ic
             JOIN users u ON u.id = ic.created_by
             LEFT JOIN categories c ON c.id = ic.kurikulum_id
             WHERE ic.id = ?`,
            [result.insertId]
        );

        res.status(201).json(created);
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// GET /api/invite-codes/validate/:code
// Public — validasi kode sebelum register (tidak butuh auth)
// =====================================================================
router.get('/validate/:code', async (req, res, next) => {
    try {
        const { code } = req.params;

        const [[ic]] = await pool.execute(
            `SELECT ic.id, ic.code, ic.max_uses, ic.used_count, ic.expires_at,
                    u.nama AS guru_nama,
                    c.name AS kurikulum_nama
             FROM invite_codes ic
             JOIN users u ON u.id = ic.created_by
             LEFT JOIN categories c ON c.id = ic.kurikulum_id
             WHERE ic.code = ? AND ic.is_active = 1
               AND (ic.expires_at IS NULL OR ic.expires_at > NOW())
               AND ic.used_count < ic.max_uses
             LIMIT 1`,
            [code]
        );

        if (!ic) {
            return res.status(404).json({ valid: false, error: 'Kode tidak valid atau sudah kadaluarsa' });
        }

        res.json({
            valid:          true,
            guru_nama:      ic.guru_nama,
            kurikulum_nama: ic.kurikulum_nama,
            sisa_uses:      ic.max_uses - ic.used_count,
        });
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// POST /api/invite-codes/:id/send-email
// Guru kirim undangan email manual ke siswa
// Body: { email, nama? }
// =====================================================================
router.post('/:id/send-email', authMiddleware, async (req, res, next) => {
    try {
        const { role, id: userId, nama: guruNama } = req.user;
        if (!['guru', 'admin'].includes(role)) {
            return res.status(403).json({ error: 'Akses ditolak' });
        }

        const [[ic]] = await pool.execute(
            `SELECT * FROM invite_codes WHERE id = ? AND created_by = ? AND is_active = 1 LIMIT 1`,
            [req.params.id, userId]
        );
        if (!ic && role !== 'admin') {
            return res.status(404).json({ error: 'Kode tidak ditemukan' });
        }

        // Kalau admin, ambil tanpa filter created_by
        const [[inviteRow]] = await pool.execute(
            `SELECT ic.*, c.name AS kurikulum_nama
             FROM invite_codes ic
             LEFT JOIN categories c ON c.id = ic.kurikulum_id
             WHERE ic.id = ?`,
            [req.params.id]
        );
        if (!inviteRow) return res.status(404).json({ error: 'Kode tidak ditemukan' });

        const { email, nama } = req.body;
        if (!email) return res.status(400).json({ error: 'Email tujuan wajib diisi' });

        const APP_URL    = process.env.APP_URL || 'http://localhost:3000';
        const inviteLink = `${APP_URL}/register?code=${inviteRow.code}`;

        await sendInviteEmail({
            toEmail:    email,
            toNama:     nama || '',
            guruNama:   guruNama,
            inviteLink,
            expiresAt:  inviteRow.expires_at,
        }).catch(err => {
            console.error('❌ Gagal kirim email undangan:', err.message);
            throw new Error('Gagal mengirim email: ' + (err.message.includes('auth') || err.message.includes('535')
                ? 'Konfigurasi SMTP belum diatur. Isi EMAIL_USER dan EMAIL_PASS di .env backend.'
                : err.message));
        });

        res.json({ success: true, message: `Email undangan terkirim ke ${email}` });
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// PATCH /api/invite-codes/:id/deactivate
// Guru/admin nonaktifkan kode
// =====================================================================
router.patch('/:id/deactivate', authMiddleware, async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        if (!['guru', 'admin'].includes(role)) {
            return res.status(403).json({ error: 'Akses ditolak' });
        }

        const whereOwner = role === 'admin' ? '' : 'AND created_by = ?';
        const params     = role === 'admin' ? [req.params.id] : [req.params.id, userId];

        const [result] = await pool.execute(
            `UPDATE invite_codes SET is_active = 0 WHERE id = ? ${whereOwner}`,
            params
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Kode tidak ditemukan' });
        }

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// DELETE /api/invite-codes/:id
// Guru/admin hapus kode (hanya yang belum dipakai)
// =====================================================================
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        if (!['guru', 'admin'].includes(role)) {
            return res.status(403).json({ error: 'Akses ditolak' });
        }

        const whereOwner = role === 'admin' ? '' : 'AND created_by = ?';
        const params     = role === 'admin'
            ? [req.params.id]
            : [req.params.id, userId];

        // Hanya boleh hapus kalau belum ada yang pakai
        const [[ic]] = await pool.execute(
            `SELECT id, used_count FROM invite_codes WHERE id = ? ${whereOwner} LIMIT 1`,
            params
        );
        if (!ic) return res.status(404).json({ error: 'Kode tidak ditemukan' });
        if (ic.used_count > 0) {
            return res.status(400).json({ error: 'Kode yang sudah dipakai tidak bisa dihapus, nonaktifkan saja' });
        }

        await pool.execute('DELETE FROM invite_codes WHERE id = ?', [ic.id]);

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
