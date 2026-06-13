const { pool } = require('../config/db');

function slugify(text) {
    return String(text || '').toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

async function listAll() {
    const [rows] = await pool.query(`
        SELECT c.id, c.parent_id, c.name, c.slug, c.description, c.color, c.sort_order, c.is_active,
               c.created_at, c.updated_at,
               (SELECT COUNT(*) FROM question_collection_items WHERE collection_id = c.id) AS question_count
        FROM question_collections c
        WHERE c.is_active = 1
        ORDER BY c.sort_order, c.name
    `);
    return rows;
}

async function search(query, limit = 20) {
    const [rows] = await pool.query(
        `SELECT id, name, slug, color, parent_id,
                (SELECT COUNT(*) FROM question_collection_items WHERE collection_id = question_collections.id) AS question_count
         FROM question_collections
         WHERE is_active = 1 AND name LIKE ?
         ORDER BY name
         LIMIT ?`,
        [`%${query}%`, limit]
    );
    return rows;
}

async function getById(id) {
    const [rows] = await pool.query(
        `SELECT c.*,
                (SELECT COUNT(*) FROM question_collection_items WHERE collection_id = c.id) AS question_count
         FROM question_collections c WHERE c.id = ?`,
        [id]
    );
    return rows[0] || null;
}

async function getOrCreate(name, conn = pool, userId = null) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;

    const slug = slugify(trimmed);
    const [existing] = await conn.query('SELECT * FROM question_collections WHERE slug = ?', [slug]);
    if (existing[0]) return existing[0];

    const [result] = await conn.execute(
        'INSERT INTO question_collections (name, slug, created_by) VALUES (?, ?, ?)',
        [trimmed, slug, userId]
    );
    const [created] = await conn.query('SELECT * FROM question_collections WHERE id = ?', [result.insertId]);
    return created[0];
}

async function create({ name, description = null, color = null, parent_id = null, sort_order = 0 }, userId = null) {
    if (!name) throw new Error('name wajib diisi');

    let slug = slugify(name);
    let suffix = 0;
    while (true) {
        const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
        const [exists] = await pool.query('SELECT id FROM question_collections WHERE slug = ?', [candidate]);
        if (exists.length === 0) {
            slug = candidate;
            break;
        }
        suffix++;
    }

    const [result] = await pool.execute(
        `INSERT INTO question_collections (name, slug, description, color, parent_id, sort_order, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name.trim(), slug, description, color, parent_id, sort_order, userId]
    );
    return getById(result.insertId);
}

async function update(id, data) {
    const fields = [];
    const values = [];
    ['name', 'description', 'color', 'parent_id', 'sort_order', 'is_active'].forEach(key => {
        if (data[key] !== undefined) {
            fields.push(`${key} = ?`);
            values.push(data[key]);
            if (key === 'name') {
                fields.push('slug = ?');
                values.push(slugify(data.name));
            }
        }
    });
    if (fields.length === 0) return getById(id);

    values.push(id);
    await pool.execute(
        `UPDATE question_collections SET ${fields.join(', ')} WHERE id = ?`,
        values
    );
    return getById(id);
}

async function remove(id) {
    await pool.execute('UPDATE question_collections SET is_active = 0 WHERE id = ?', [id]);
    return true;
}

// Daftar soal di sebuah collection
async function listQuestions(collectionId, { page = 1, limit = 20 } = {}) {
    const offset = (Math.max(1, page) - 1) * limit;
    const [rows] = await pool.query(
        `SELECT q.id, q.type, q.difficulty, q.default_marks,
                LEFT(q.content, 200) AS content_preview,
                qci.sort_order
         FROM question_collection_items qci
         INNER JOIN questions q ON q.id = qci.question_id
         WHERE qci.collection_id = ? AND q.is_active = 1
         ORDER BY qci.sort_order, q.id
         LIMIT ? OFFSET ?`,
        [collectionId, limit, offset]
    );
    const [countRows] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM question_collection_items qci
         INNER JOIN questions q ON q.id = qci.question_id
         WHERE qci.collection_id = ? AND q.is_active = 1`,
        [collectionId]
    );
    return {
        data: rows,
        total: countRows[0].total,
        page,
        limit,
        total_pages: Math.ceil(countRows[0].total / limit)
    };
}

module.exports = {
    listAll,
    search,
    getById,
    getOrCreate,
    create,
    update,
    remove,
    listQuestions
};
