const { pool } = require('../config/db');

// List semua kategori (flat) dengan info parent
async function listAll({ parent_id, level } = {}) {
    const conditions = ['is_active = 1'];
    const params = [];
    if (level) { conditions.push('level = ?'); params.push(level); }
    if (parent_id !== undefined) { conditions.push('parent_id = ?'); params.push(parent_id); }

    const [rows] = await pool.query(
        `SELECT id, parent_id, code, name, slug, level, description, sort_order, is_active
         FROM categories
         WHERE ${conditions.join(' AND ')}
         ORDER BY sort_order, name`,
        params
    );
    return rows;
}

// Build hierarki tree: kurikulum → subtes → topik → subtopik
async function listTree() {
    const [rows] = await pool.query(`
        SELECT id, parent_id, code, name, slug, level, description, sort_order, is_active
        FROM categories
        WHERE is_active = 1
        ORDER BY sort_order, name
    `);
    const byId = new Map();
    rows.forEach(c => byId.set(c.id, { ...c, children: [] }));

    const roots = [];
    for (const node of byId.values()) {
        if (node.parent_id && byId.has(node.parent_id)) {
            byId.get(node.parent_id).children.push(node);
        } else {
            roots.push(node);
        }
    }
    return roots;
}

// Ambil tree hanya untuk kurikulum tertentu (by kurikulum_id)
async function listTreeByKurikulum(kurikulumId) {
    const [rows] = await pool.query(`
        WITH RECURSIVE cat_tree AS (
            SELECT id, parent_id, code, name, slug, level, sort_order
            FROM categories WHERE id = ? AND is_active = 1
            UNION ALL
            SELECT c.id, c.parent_id, c.code, c.name, c.slug, c.level, c.sort_order
            FROM categories c
            INNER JOIN cat_tree ct ON c.parent_id = ct.id
            WHERE c.is_active = 1
        )
        SELECT * FROM cat_tree ORDER BY sort_order, name
    `, [kurikulumId]);

    const byId = new Map();
    rows.forEach(c => byId.set(c.id, { ...c, children: [] }));
    const roots = [];
    for (const node of byId.values()) {
        if (node.parent_id && byId.has(node.parent_id)) {
            byId.get(node.parent_id).children.push(node);
        } else {
            roots.push(node);
        }
    }
    return roots[0] || null;
}

// Filter per level
async function listByLevel(level) {
    return listAll({ level });
}

// Children langsung dari sebuah kategori
async function listChildren(parentId) {
    return listAll({ parent_id: parentId });
}

// Ambil semua kurikulum (root nodes)
async function listKurikulum() {
    return listAll({ level: 'kurikulum' });
}

// Ambil subtes/mapel untuk kurikulum tertentu
async function listSubtesByKurikulum(kurikulumId) {
    return listAll({ parent_id: kurikulumId, level: 'subtes' });
}

// Ambil kurikulum yang ditugaskan ke guru
async function getKurikulumByGuru(userId) {
    const [rows] = await pool.query(
        `SELECT c.id, c.code, c.name, c.slug, c.sort_order
         FROM guru_kurikulum gk
         JOIN categories c ON c.id = gk.kurikulum_id
         WHERE gk.user_id = ? AND c.is_active = 1
         ORDER BY c.sort_order`,
        [userId]
    );
    return rows;
}

// Set kurikulum untuk guru (replace all)
async function setKurikulumGuru(userId, kurikulumIds) {
    await pool.execute('DELETE FROM guru_kurikulum WHERE user_id = ?', [userId]);
    if (!kurikulumIds || kurikulumIds.length === 0) return;
    const values = kurikulumIds.map(() => '(?, ?)').join(', ');
    const params = kurikulumIds.flatMap(kid => [userId, kid]);
    await pool.execute(
        `INSERT INTO guru_kurikulum (user_id, kurikulum_id) VALUES ${values}`,
        params
    );
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
    listTreeByKurikulum,
    listByLevel,
    listChildren,
    listKurikulum,
    listSubtesByKurikulum,
    getKurikulumByGuru,
    setKurikulumGuru,
    getById,
    create,
    update,
    remove
};
