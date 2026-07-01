const { pool } = require('../config/db');

// =====================================================================
// Kolom yang boleh di-select
// =====================================================================
const SELECT_COLS = `
    m.id, m.judul, m.deskripsi, m.jenis,
    m.file_url, m.video_url, m.link_url,
    m.mime_type, m.file_size, m.original_name,
    m.kurikulum_id, m.subtes_id,
    m.is_active, m.sort_order,
    m.created_by, m.created_at, m.updated_at,
    u.nama      AS created_by_nama,
    u.role      AS created_by_role,
    k.name      AS kurikulum_name,
    k.code      AS kurikulum_code,
    s.name      AS subtes_name,
    s.code      AS subtes_code
`;

// =====================================================================
// LIST — untuk siswa (filter by jenjang) atau guru/admin (semua aktif)
// =====================================================================
async function listMateri({ role, userId, kurikulum_id, subtes_id, jenis } = {}) {
    const params = [];
    const conditions = ['m.is_active = 1'];

    if (role === 'siswa') {
        // Hanya materi dari kurikulum yang terdaftar untuk siswa ini
        conditions.push(`m.kurikulum_id IN (
            SELECT kurikulum_id FROM user_jenjang WHERE user_id = ?
        )`);
        params.push(userId);
    }

    if (kurikulum_id) {
        conditions.push('m.kurikulum_id = ?');
        params.push(parseInt(kurikulum_id));
    }

    if (subtes_id) {
        conditions.push('m.subtes_id = ?');
        params.push(parseInt(subtes_id));
    }

    if (jenis) {
        conditions.push('m.jenis = ?');
        params.push(jenis);
    }

    const where = conditions.join(' AND ');

    const [rows] = await pool.execute(
        `SELECT ${SELECT_COLS}
         FROM materi m
         JOIN users      u ON u.id = m.created_by
         JOIN categories k ON k.id = m.kurikulum_id
         LEFT JOIN categories s ON s.id = m.subtes_id
         WHERE ${where}
         ORDER BY m.sort_order ASC, m.created_at DESC`,
        params
    );
    return rows;
}

// =====================================================================
// LIST MANAGE — guru lihat miliknya sendiri, admin lihat semua
// =====================================================================
async function listMateriManage({ role, userId, kurikulum_id, subtes_id } = {}) {
    const params = [];
    const conditions = [];

    if (role === 'guru') {
        conditions.push('m.created_by = ?');
        params.push(userId);
    }

    if (kurikulum_id) {
        conditions.push('m.kurikulum_id = ?');
        params.push(parseInt(kurikulum_id));
    }

    if (subtes_id) {
        conditions.push('m.subtes_id = ?');
        params.push(parseInt(subtes_id));
    }

    const where = conditions.length ? conditions.join(' AND ') : '1=1';

    const [rows] = await pool.execute(
        `SELECT ${SELECT_COLS}
         FROM materi m
         JOIN users      u ON u.id = m.created_by
         JOIN categories k ON k.id = m.kurikulum_id
         LEFT JOIN categories s ON s.id = m.subtes_id
         WHERE ${where}
         ORDER BY m.sort_order ASC, m.created_at DESC`,
        params
    );
    return rows;
}

// =====================================================================
// GET BY ID
// =====================================================================
async function getMateriById(id) {
    const [[row]] = await pool.execute(
        `SELECT ${SELECT_COLS}
         FROM materi m
         JOIN users      u ON u.id = m.created_by
         JOIN categories k ON k.id = m.kurikulum_id
         LEFT JOIN categories s ON s.id = m.subtes_id
         WHERE m.id = ?`,
        [id]
    );
    return row || null;
}

// =====================================================================
// CREATE
// =====================================================================
async function createMateri(
    { judul, deskripsi, jenis, file_url, video_url, link_url,
      mime_type, file_size, original_name, kurikulum_id, subtes_id, sort_order },
    createdBy
) {
    if (!judul?.trim())           throw new Error('Judul materi wajib diisi');
    if (!jenis)                   throw new Error('Jenis materi wajib diisi');
    if (!kurikulum_id)            throw new Error('Kurikulum wajib dipilih');
    if (jenis === 'file'      && !file_url)   throw new Error('File belum diupload');
    if (jenis === 'video_url' && !video_url)  throw new Error('URL video wajib diisi');
    if (jenis === 'link'      && !link_url)   throw new Error('URL link wajib diisi');

    const [result] = await pool.execute(
        `INSERT INTO materi
            (judul, deskripsi, jenis, file_url, video_url, link_url,
             mime_type, file_size, original_name, kurikulum_id, subtes_id, sort_order, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            judul.trim(),
            deskripsi?.trim() || null,
            jenis,
            file_url      || null,
            video_url     || null,
            link_url      || null,
            mime_type     || null,
            file_size     || null,
            original_name || null,
            parseInt(kurikulum_id),
            subtes_id ? parseInt(subtes_id) : null,
            sort_order ?? 0,
            createdBy,
        ]
    );

    return getMateriById(result.insertId);
}

// =====================================================================
// UPDATE — hanya pembuat atau admin
// =====================================================================
async function updateMateri(id, fields, { role, userId }) {
    const existing = await getMateriById(id);
    if (!existing) {
        const err = new Error('Materi tidak ditemukan');
        err.status = 404;
        throw err;
    }
    if (role !== 'admin' && existing.created_by !== userId) {
        const err = new Error('Tidak bisa mengedit materi orang lain');
        err.status = 403;
        throw err;
    }

    const allowed = [
        'judul', 'deskripsi', 'jenis', 'file_url', 'video_url', 'link_url',
        'mime_type', 'file_size', 'original_name', 'kurikulum_id', 'subtes_id',
        'is_active', 'sort_order',
    ];

    const sets = [];
    const params = [];
    for (const key of allowed) {
        if (key in fields) {
            sets.push(`${key} = ?`);
            params.push(fields[key] ?? null);
        }
    }
    if (!sets.length) throw new Error('Tidak ada field yang diupdate');

    params.push(id);
    await pool.execute(`UPDATE materi SET ${sets.join(', ')} WHERE id = ?`, params);
    return getMateriById(id);
}

// =====================================================================
// DELETE (soft delete — set is_active = 0)
// =====================================================================
async function deleteMateri(id, { role, userId }) {
    const existing = await getMateriById(id);
    if (!existing) {
        const err = new Error('Materi tidak ditemukan');
        err.status = 404;
        throw err;
    }
    if (role !== 'admin' && existing.created_by !== userId) {
        const err = new Error('Tidak bisa menghapus materi orang lain');
        err.status = 403;
        throw err;
    }

    await pool.execute('UPDATE materi SET is_active = 0 WHERE id = ?', [id]);
    return { success: true };
}

module.exports = {
    listMateri,
    listMateriManage,
    getMateriById,
    createMateri,
    updateMateri,
    deleteMateri,
};
