const { pool } = require('../config/db');

function slugify(text) {
    return String(text || '').toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

async function listAll() {
    const [rows] = await pool.query(
        `SELECT id, name, slug, color, usage_count
         FROM tags
         ORDER BY usage_count DESC, name`
    );
    return rows;
}

async function search(query, limit = 20) {
    const [rows] = await pool.query(
        `SELECT id, name, slug, color, usage_count
         FROM tags
         WHERE name LIKE ?
         ORDER BY usage_count DESC, name
         LIMIT ?`,
        [`%${query}%`, limit]
    );
    return rows;
}

async function getById(id) {
    const [rows] = await pool.query('SELECT * FROM tags WHERE id = ?', [id]);
    return rows[0] || null;
}

async function getOrCreate(name, conn = pool) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;

    const slug = slugify(trimmed);
    const [existing] = await conn.query('SELECT * FROM tags WHERE slug = ?', [slug]);
    if (existing[0]) return existing[0];

    const [result] = await conn.execute(
        'INSERT INTO tags (name, slug) VALUES (?, ?)',
        [trimmed, slug]
    );
    const [created] = await conn.query('SELECT * FROM tags WHERE id = ?', [result.insertId]);
    return created[0];
}

async function create({ name, color = null }) {
    if (!name) throw new Error('name wajib diisi');

    const slug = slugify(name);
    const [exists] = await pool.query('SELECT id FROM tags WHERE slug = ?', [slug]);
    if (exists.length) throw new Error('Tag dengan nama serupa sudah ada');

    const [result] = await pool.execute(
        'INSERT INTO tags (name, slug, color) VALUES (?, ?, ?)',
        [name.trim(), slug, color]
    );
    return getById(result.insertId);
}

async function update(id, { name, color }) {
    const fields = [];
    const values = [];
    if (name !== undefined) {
        fields.push('name = ?', 'slug = ?');
        values.push(name.trim(), slugify(name));
    }
    if (color !== undefined) {
        fields.push('color = ?');
        values.push(color);
    }
    if (fields.length === 0) return getById(id);

    values.push(id);
    await pool.execute(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`, values);
    return getById(id);
}

async function remove(id) {
    await pool.execute('DELETE FROM tags WHERE id = ?', [id]);
    return true;
}

// Hitung ulang usage_count (jaga konsistensi)
async function refreshUsageCount(tagId, conn = pool) {
    await conn.execute(
        `UPDATE tags t
         SET usage_count = (SELECT COUNT(*) FROM question_tags WHERE tag_id = t.id)
         WHERE t.id = ?`,
        [tagId]
    );
}

module.exports = {
    listAll,
    search,
    getById,
    getOrCreate,
    create,
    update,
    remove,
    refreshUsageCount
};
