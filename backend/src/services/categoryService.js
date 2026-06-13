const { pool } = require('../config/db');

// List semua kategori (flat) dengan info parent
async function listAll() {
    const [rows] = await pool.query(`
        SELECT id, parent_id, code, name, slug, level, description, sort_order, is_active
        FROM categories
        WHERE is_active = 1
        ORDER BY level, sort_order, name
    `);
    return rows;
}

// Build hierarki tree: subtes → topik → subtopik
async function listTree() {
    const flat = await listAll();
    const byId = new Map();
    flat.forEach(c => byId.set(c.id, { ...c, children: [] }));

    const roots = [];
    for (const node of byId.values()) {
        if (node.parent_id) {
            const parent = byId.get(node.parent_id);
            if (parent) parent.children.push(node);
            else roots.push(node);
        } else {
            roots.push(node);
        }
    }
    return roots;
}

// Filter per level
async function listByLevel(level) {
    const [rows] = await pool.query(
        `SELECT id, parent_id, code, name, slug, level, sort_order
         FROM categories WHERE level = ? AND is_active = 1
         ORDER BY sort_order, name`,
        [level]
    );
    return rows;
}

// Children langsung dari sebuah kategori
async function listChildren(parentId) {
    const [rows] = await pool.query(
        `SELECT id, parent_id, code, name, slug, level, sort_order
         FROM categories WHERE parent_id = ? AND is_active = 1
         ORDER BY sort_order, name`,
        [parentId]
    );
    return rows;
}

async function getById(id) {
    const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [id]);
    return rows[0] || null;
}

// Slugify simple
function slugify(text) {
    return text.toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

async function create({ parent_id = null, code = null, name, level, description = null, sort_order = 0 }) {
    if (!name || !level) throw new Error('name dan level wajib diisi');

    let slug = slugify(name);
    // Pastikan slug unik
    let suffix = 0;
    while (true) {
        const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
        const [exists] = await pool.query('SELECT id FROM categories WHERE slug = ?', [candidate]);
        if (exists.length === 0) {
            slug = candidate;
            break;
        }
        suffix++;
    }

    const [result] = await pool.execute(
        `INSERT INTO categories (parent_id, code, name, slug, level, description, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [parent_id, code, name, slug, level, description, sort_order]
    );

    return getById(result.insertId);
}

async function update(id, data) {
    const fields = [];
    const values = [];

    ['parent_id', 'code', 'name', 'description', 'sort_order', 'is_active'].forEach(key => {
        if (data[key] !== undefined) {
            fields.push(`${key} = ?`);
            values.push(data[key]);
        }
    });

    if (fields.length === 0) return getById(id);

    values.push(id);
    await pool.execute(
        `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`,
        values
    );
    return getById(id);
}

async function remove(id) {
    // Soft delete via is_active flag agar tidak break referensi soal
    await pool.execute('UPDATE categories SET is_active = 0 WHERE id = ?', [id]);
    return true;
}

module.exports = {
    listAll,
    listTree,
    listByLevel,
    listChildren,
    getById,
    create,
    update,
    remove
};
