const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const notif = require('../services/notificationService');

// =====================================================================
// GET /api/announcements
// Siswa: lihat pengumuman aktif yang sesuai role-nya
// Guru/Admin: lihat semua pengumuman aktif
// =====================================================================
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const { role } = req.user;
        let where = 'a.is_active = 1';
        if (role === 'siswa') {
            where += ` AND (a.target_role = 'all' OR a.target_role = 'siswa')`;
        } else if (role === 'guru') {
            where += ` AND (a.target_role = 'all' OR a.target_role = 'guru')`;
        }

        const [rows] = await pool.execute(
            `SELECT a.id, a.title, a.content, a.target_role, a.is_active,
                    a.created_at, a.updated_at,
                    u.nama AS created_by_nama, u.role AS created_by_role
             FROM announcements a
             JOIN users u ON u.id = a.created_by
             WHERE ${where}
             ORDER BY a.created_at DESC
             LIMIT 50`
        );
        res.json({ total: rows.length, data: rows });
    } catch (err) { next(err); }
});

// =====================================================================
// GET /api/announcements/manage — HARUS sebelum /:id
// Guru: lihat pengumuman yang dia buat
// Admin: lihat semua
// =====================================================================
router.get('/manage', authMiddleware, requireRole('guru', 'admin'), async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const where = role === 'admin' ? '1=1' : 'a.created_by = ?';
        const params = role === 'admin' ? [] : [userId];

        const [rows] = await pool.execute(
            `SELECT a.id, a.title, a.content, a.target_role, a.is_active,
                    a.created_at, a.updated_at,
                    u.nama AS created_by_nama
             FROM announcements a
             JOIN users u ON u.id = a.created_by
             WHERE ${where}
             ORDER BY a.created_at DESC`,
            params
        );
        res.json({ total: rows.length, data: rows });
    } catch (err) { next(err); }
});

// =====================================================================
// GET /api/announcements/:id — HARUS setelah semua route spesifik
// Detail satu pengumuman — untuk user yang login
// =====================================================================
router.get('/:id', authMiddleware, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });

        const [[a]] = await pool.execute(
            `SELECT a.id, a.title, a.content, a.target_role, a.created_at,
                    u.nama AS created_by_nama
             FROM announcements a
             JOIN users u ON u.id = a.created_by
             WHERE a.id = ? AND a.is_active = 1 LIMIT 1`,
            [id]
        );
        if (!a) return res.status(404).json({ error: 'Pengumuman tidak ditemukan' });
        res.json(a);
    } catch (err) { next(err); }
});

// =====================================================================
// POST /api/announcements
// Guru: buat pengumuman ke siswanya saja (target_role = 'siswa')
// Admin: bisa pilih target_role (all/siswa/guru)
// =====================================================================
router.post('/', authMiddleware, requireRole('guru', 'admin'), async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const { title, content, target_role = 'siswa' } = req.body;

        if (!title?.trim()) return res.status(400).json({ error: 'Judul wajib diisi' });
        if (title.trim().length > 255) return res.status(400).json({ error: 'Judul maksimal 255 karakter' });
        if (!content?.trim()) return res.status(400).json({ error: 'Konten wajib diisi' });
        if (content.trim().length > 5120) return res.status(400).json({ error: 'Konten maksimal 5.120 karakter' });

        // Guru hanya boleh target siswa, admin bebas
        const finalTarget = role === 'guru' ? 'siswa' : target_role;
        if (!['all', 'siswa', 'guru'].includes(finalTarget)) {
            return res.status(400).json({ error: 'Target role tidak valid' });
        }

        const [result] = await pool.execute(
            `INSERT INTO announcements (title, content, created_by, target_role) VALUES (?, ?, ?, ?)`,
            [title.trim(), content.trim(), userId, finalTarget]
        );
        const [[announcement]] = await pool.execute(
            'SELECT * FROM announcements WHERE id = ?', [result.insertId]
        );

        // Kirim notifikasi in-app + email ke target users
        // URL menyertakan announcement ID agar siswa bisa baca konten penuh
        const notifPayload = {
            type: 'announcement',
            title: `Pengumuman: ${title.trim()}`,
            body: content.trim().slice(0, 200),
            url: `/siswa/notifikasi?announcement=${result.insertId}`,
        };

        if (role === 'guru') {
            notif.broadcastToGursSiswa({
                guru_id: userId,
                ...notifPayload,
                url: `/siswa/notifikasi?announcement=${result.insertId}`,
            }).catch(err => console.warn('⚠️  Notif announcement gagal:', err.message));
        } else {
            // Admin: URL berbeda per role target
            const targets = finalTarget === 'all' ? ['siswa', 'guru'] : [finalTarget];
            for (const r of targets) {
                const url = r === 'guru'
                    ? `/guru/pengumuman?announcement=${result.insertId}`
                    : `/siswa/notifikasi?announcement=${result.insertId}`;
                notif.broadcast({ role: r, ...notifPayload, url })
                    .catch(err => console.warn('⚠️  Notif announcement gagal:', err.message));
            }
        }

        res.status(201).json(announcement);
    } catch (err) { next(err); }
});

// =====================================================================
// PUT /api/announcements/:id
// Update pengumuman — hanya pembuat atau admin
// =====================================================================
router.put('/:id', authMiddleware, requireRole('guru', 'admin'), async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const id = parseInt(req.params.id);
        const { title, content, target_role, is_active } = req.body;

        const [[existing]] = await pool.execute(
            'SELECT * FROM announcements WHERE id = ? LIMIT 1', [id]
        );
        if (!existing) return res.status(404).json({ error: 'Pengumuman tidak ditemukan' });
        if (role !== 'admin' && existing.created_by !== userId) {
            return res.status(403).json({ error: 'Tidak bisa mengedit pengumuman orang lain' });
        }

        // Validasi panjang jika ada perubahan konten
        if (title && title.trim().length > 255) return res.status(400).json({ error: 'Judul maksimal 255 karakter' });
        if (content && content.trim().length > 5120) return res.status(400).json({ error: 'Konten maksimal 5.120 karakter' });

        const finalTarget = role === 'guru' ? 'siswa' : (target_role || existing.target_role);
        await pool.execute(
            `UPDATE announcements SET title = ?, content = ?, target_role = ?, is_active = ?, updated_at = NOW()
             WHERE id = ?`,
            [
                title?.trim() || existing.title,
                content?.trim() || existing.content,
                finalTarget,
                is_active !== undefined ? is_active : existing.is_active,
                id
            ]
        );
        const [[updated]] = await pool.execute('SELECT * FROM announcements WHERE id = ?', [id]);
        res.json(updated);
    } catch (err) { next(err); }
});

// =====================================================================
// DELETE /api/announcements/:id
// Hapus pengumuman — hanya pembuat atau admin
// =====================================================================
router.delete('/:id', authMiddleware, requireRole('guru', 'admin'), async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const id = parseInt(req.params.id);

        const [[existing]] = await pool.execute(
            'SELECT * FROM announcements WHERE id = ? LIMIT 1', [id]
        );
        if (!existing) return res.status(404).json({ error: 'Pengumuman tidak ditemukan' });
        if (role !== 'admin' && existing.created_by !== userId) {
            return res.status(403).json({ error: 'Tidak bisa menghapus pengumuman orang lain' });
        }

        await pool.execute('DELETE FROM announcements WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) { next(err); }
});

module.exports = router;
