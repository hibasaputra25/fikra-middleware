const { pool } = require('../config/db');
const tagService = require('./tagService');
const collectionService = require('./collectionService');

const QUESTION_TYPES = ['mcq_single', 'mcq_multi', 'true_false', 'short_answer', 'essay', 'numeric'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

// =====================================================================
// READ
// =====================================================================

async function list({
    category_id,
    kurikulum_id,
    type,
    difficulty,
    search,
    tag_id,
    collection_id,
    created_by,       // filter by creator (untuk guru: hanya soal sendiri)
    page = 1,
    limit = 20
} = {}) {
    const conditions = ['q.is_active = 1'];
    const params = [];
    const joins = [];

    if (tag_id) {
        joins.push('INNER JOIN question_tags qt ON qt.question_id = q.id AND qt.tag_id = ?');
        params.push(tag_id);
    }
    if (collection_id) {
        joins.push('INNER JOIN question_collection_items qci ON qci.question_id = q.id AND qci.collection_id = ?');
        params.push(collection_id);
    }
    if (category_id) {
        // Filter by subtes spesifik
        conditions.push('q.category_id = ?');
        params.push(category_id);
    } else if (kurikulum_id) {
        // Filter by kurikulum — ambil semua soal yang category-nya adalah child dari kurikulum ini
        // Harus pakai subquery karena LEFT JOIN categories c mungkin NULL
        conditions.push('q.category_id IN (SELECT id FROM categories WHERE parent_id = ? AND level = \'subtes\')');
        params.push(kurikulum_id);
    }
    if (type) {
        conditions.push('q.type = ?');
        params.push(type);
    }
    if (difficulty) {
        conditions.push('q.difficulty = ?');
        params.push(difficulty);
    }
    if (search) {
        conditions.push('q.content LIKE ?');
        params.push(`%${search}%`);
    }
    if (created_by) {
        conditions.push('q.created_by = ?');
        params.push(created_by);
    }

    const whereSQL = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const joinSQL = joins.join(' ');
    const offset = (Math.max(1, page) - 1) * limit;

    const [rows] = await pool.query(
        `SELECT q.id, q.type, q.difficulty, q.default_marks, q.penalty,
                q.shuffle_options, q.try_penalty,
                q.created_at, q.updated_at,
                LEFT(q.content, 200) AS content_preview,
                c.id AS category_id, c.code AS category_code, c.name AS category_name, c.level AS category_level
         FROM questions q
         LEFT JOIN categories c ON c.id = q.category_id
         ${joinSQL}
         ${whereSQL}
         ORDER BY q.id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    // Ambil tags untuk semua row sekaligus
    if (rows.length) {
        const ids = rows.map(r => r.id);
        const placeholders = ids.map(() => '?').join(',');
        const [tagRows] = await pool.query(
            `SELECT qt.question_id, t.id, t.name, t.slug, t.color
             FROM question_tags qt
             INNER JOIN tags t ON t.id = qt.tag_id
             WHERE qt.question_id IN (${placeholders})`,
            ids
        );
        const tagMap = new Map();
        for (const r of tagRows) {
            if (!tagMap.has(r.question_id)) tagMap.set(r.question_id, []);
            tagMap.get(r.question_id).push({
                id: r.id,
                name: r.name,
                slug: r.slug,
                color: r.color
            });
        }
        rows.forEach(r => { r.tags = tagMap.get(r.id) || []; });
    }

    const [countRows] = await pool.query(
        `SELECT COUNT(DISTINCT q.id) AS total FROM questions q ${joinSQL} ${whereSQL}`,
        params
    );

    return {
        data: rows,
        total: countRows[0].total,
        page,
        limit,
        total_pages: Math.ceil(countRows[0].total / limit)
    };
}

async function getById(id) {
    const [questionRows] = await pool.query(
        `SELECT q.*, c.code AS category_code, c.name AS category_name, c.level AS category_level
         FROM questions q
         LEFT JOIN categories c ON c.id = q.category_id
         WHERE q.id = ?`,
        [id]
    );
    if (!questionRows[0]) return null;

    const question = questionRows[0];

    const [options] = await pool.query(
        `SELECT id, content, is_correct, feedback, sort_order
         FROM question_options
         WHERE question_id = ?
         ORDER BY sort_order, id`,
        [id]
    );

    const [answers] = await pool.query(
        `SELECT id, answer_text, numeric_value, numeric_tolerance, match_type
         FROM question_answers
         WHERE question_id = ?`,
        [id]
    );

    const [images] = await pool.query(
        `SELECT id, option_id, url, alt_text, position, sort_order
         FROM question_images
         WHERE question_id = ?
         ORDER BY sort_order, id`,
        [id]
    );

    const [hints] = await pool.query(
        `SELECT id, content, sort_order, clear_wrong, show_num_correct
         FROM question_hints
         WHERE question_id = ?
         ORDER BY sort_order, id`,
        [id]
    );

    const [tags] = await pool.query(
        `SELECT t.id, t.name, t.slug, t.color
         FROM tags t
         INNER JOIN question_tags qt ON qt.tag_id = t.id
         WHERE qt.question_id = ?`,
        [id]
    );

    const [collections] = await pool.query(
        `SELECT c.id, c.name, c.slug, c.color
         FROM question_collections c
         INNER JOIN question_collection_items qci ON qci.collection_id = c.id
         WHERE qci.question_id = ? AND c.is_active = 1
         ORDER BY c.name`,
        [id]
    );

    return {
        ...question,
        options,
        answers,
        images,
        hints,
        tags,
        collections
    };
}

// =====================================================================
// VALIDATION
// =====================================================================

function validatePayload(payload) {
    if (!payload.type || !QUESTION_TYPES.includes(payload.type)) {
        throw new Error(`type wajib salah satu dari: ${QUESTION_TYPES.join(', ')}`);
    }
    if (!payload.content || !String(payload.content).trim()) {
        throw new Error('content soal wajib diisi');
    }
    if (payload.difficulty && !DIFFICULTIES.includes(payload.difficulty)) {
        throw new Error(`difficulty wajib salah satu dari: ${DIFFICULTIES.join(', ')}`);
    }
    if (payload.try_penalty !== undefined) {
        const p = Number(payload.try_penalty);
        if (isNaN(p) || p < 0 || p > 1) {
            throw new Error('try_penalty harus antara 0 sampai 1 (persentase desimal)');
        }
    }

    // Kategori soal (collection) wajib dipilih
    if (payload.collections !== undefined) {
        if (!Array.isArray(payload.collections) || payload.collections.length === 0) {
            throw new Error('Kategori soal wajib dipilih');
        }
        const hasValid = payload.collections.some(c => c && (c.id || (c.name && String(c.name).trim())));
        if (!hasValid) {
            throw new Error('Kategori soal wajib dipilih');
        }
    }

    if (['mcq_single', 'mcq_multi', 'true_false'].includes(payload.type)) {
        if (!Array.isArray(payload.options) || payload.options.length < 2) {
            throw new Error('Soal pilihan ganda wajib punya minimal 2 opsi');
        }
        const correctCount = payload.options.filter(o => o.is_correct).length;
        if (payload.type === 'mcq_single' || payload.type === 'true_false') {
            if (correctCount !== 1) {
                throw new Error('Soal pilihan tunggal wajib punya tepat 1 opsi benar');
            }
        } else if (payload.type === 'mcq_multi') {
            if (correctCount < 1) {
                throw new Error('Soal pilihan multi wajib punya minimal 1 opsi benar');
            }
        }
    }

    if (payload.type === 'short_answer') {
        if (!Array.isArray(payload.answers) || payload.answers.length === 0) {
            throw new Error('Soal isian singkat wajib punya minimal 1 kunci jawaban');
        }
    }

    if (payload.type === 'numeric') {
        if (!Array.isArray(payload.answers) || payload.answers.length === 0) {
            throw new Error('Soal numerik wajib punya minimal 1 kunci jawaban');
        }
        const hasNumeric = payload.answers.some(a => a.numeric_value !== null && a.numeric_value !== undefined && a.numeric_value !== '');
        if (!hasNumeric) {
            throw new Error('Soal numerik wajib punya numeric_value');
        }
    }
}

// =====================================================================
// HELPERS — replace child rows dengan transaction
// =====================================================================

async function replaceOptions(conn, questionId, options) {
    await conn.execute('DELETE FROM question_options WHERE question_id = ?', [questionId]);
    if (!Array.isArray(options) || options.length === 0) return;

    for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        await conn.execute(
            `INSERT INTO question_options (question_id, content, is_correct, feedback, sort_order)
             VALUES (?, ?, ?, ?, ?)`,
            [
                questionId,
                opt.content,
                opt.is_correct ? 1 : 0,
                opt.feedback || null,
                opt.sort_order ?? i
            ]
        );
    }
}

async function replaceAnswers(conn, questionId, answers) {
    await conn.execute('DELETE FROM question_answers WHERE question_id = ?', [questionId]);
    if (!Array.isArray(answers) || answers.length === 0) return;

    for (const ans of answers) {
        await conn.execute(
            `INSERT INTO question_answers
                (question_id, answer_text, numeric_value, numeric_tolerance, match_type)
             VALUES (?, ?, ?, ?, ?)`,
            [
                questionId,
                ans.answer_text || null,
                ans.numeric_value !== '' && ans.numeric_value !== null && ans.numeric_value !== undefined
                    ? Number(ans.numeric_value)
                    : null,
                ans.numeric_tolerance !== '' && ans.numeric_tolerance !== null && ans.numeric_tolerance !== undefined
                    ? Number(ans.numeric_tolerance)
                    : null,
                ans.match_type || 'case_insensitive'
            ]
        );
    }
}

async function replaceImages(conn, questionId, images) {
    await conn.execute('DELETE FROM question_images WHERE question_id = ?', [questionId]);
    if (!Array.isArray(images) || images.length === 0) return;

    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        await conn.execute(
            `INSERT INTO question_images
                (question_id, option_id, url, alt_text, position, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                questionId,
                img.option_id || null,
                img.url,
                img.alt_text || null,
                img.position || 'question',
                img.sort_order ?? i
            ]
        );
    }
}

async function replaceHints(conn, questionId, hints) {
    await conn.execute('DELETE FROM question_hints WHERE question_id = ?', [questionId]);
    if (!Array.isArray(hints) || hints.length === 0) return;

    for (let i = 0; i < hints.length; i++) {
        const h = hints[i];
        if (!h.content || !String(h.content).trim()) continue;
        await conn.execute(
            `INSERT INTO question_hints (question_id, content, sort_order, clear_wrong, show_num_correct)
             VALUES (?, ?, ?, ?, ?)`,
            [
                questionId,
                h.content,
                h.sort_order ?? i,
                h.clear_wrong ? 1 : 0,
                h.show_num_correct ? 1 : 0
            ]
        );
    }
}

// tags array bisa berisi: { id?: number, name?: string }
async function replaceTags(conn, questionId, tags) {
    // Ambil tag lama untuk update usage_count
    const [oldRows] = await conn.query(
        'SELECT tag_id FROM question_tags WHERE question_id = ?',
        [questionId]
    );
    const oldTagIds = oldRows.map(r => r.tag_id);

    await conn.execute('DELETE FROM question_tags WHERE question_id = ?', [questionId]);

    const newTagIds = [];
    if (Array.isArray(tags)) {
        for (const t of tags) {
            let tagId = t.id;
            if (!tagId && t.name) {
                const created = await tagService.getOrCreate(t.name, conn);
                if (created) tagId = created.id;
            }
            if (tagId && !newTagIds.includes(tagId)) newTagIds.push(tagId);
        }
    }

    for (const tagId of newTagIds) {
        await conn.execute(
            'INSERT INTO question_tags (question_id, tag_id) VALUES (?, ?)',
            [questionId, tagId]
        );
    }

    // Refresh usage_count untuk tag yang berubah
    const affectedTags = [...new Set([...oldTagIds, ...newTagIds])];
    for (const tagId of affectedTags) {
        await tagService.refreshUsageCount(tagId, conn);
    }
}

// collections array bisa berisi: { id?: number, name?: string }
async function replaceCollections(conn, questionId, collections, userId = null) {
    await conn.execute('DELETE FROM question_collection_items WHERE question_id = ?', [questionId]);

    const collectionIds = [];
    if (Array.isArray(collections)) {
        for (const c of collections) {
            let collectionId = c.id;
            if (!collectionId && c.name) {
                const created = await collectionService.getOrCreate(c.name, conn, userId);
                if (created) collectionId = created.id;
            }
            if (collectionId && !collectionIds.includes(collectionId)) {
                collectionIds.push(collectionId);
            }
        }
    }

    for (let i = 0; i < collectionIds.length; i++) {
        await conn.execute(
            `INSERT INTO question_collection_items (collection_id, question_id, sort_order, added_by)
             VALUES (?, ?, ?, ?)`,
            [collectionIds[i], questionId, i, userId]
        );
    }
}

// =====================================================================
// VERSIONING
// =====================================================================

async function snapshotQuestion(conn, questionId) {
    const [qRows] = await conn.query('SELECT * FROM questions WHERE id = ?', [questionId]);
    if (!qRows[0]) return null;

    const [options] = await conn.query(
        'SELECT * FROM question_options WHERE question_id = ? ORDER BY sort_order, id',
        [questionId]
    );
    const [answers] = await conn.query(
        'SELECT * FROM question_answers WHERE question_id = ?',
        [questionId]
    );
    const [images] = await conn.query(
        'SELECT * FROM question_images WHERE question_id = ?',
        [questionId]
    );
    const [hints] = await conn.query(
        'SELECT * FROM question_hints WHERE question_id = ? ORDER BY sort_order, id',
        [questionId]
    );
    const [tags] = await conn.query(
        `SELECT t.id, t.name, t.slug FROM tags t
         INNER JOIN question_tags qt ON qt.tag_id = t.id
         WHERE qt.question_id = ?`,
        [questionId]
    );

    return {
        question: qRows[0],
        options,
        answers,
        images,
        hints,
        tags
    };
}

async function saveRevision(conn, questionId, changeNote, changedBy) {
    const snapshot = await snapshotQuestion(conn, questionId);
    if (!snapshot) return;

    const [maxRow] = await conn.query(
        'SELECT MAX(revision_number) AS max_rev FROM question_revisions WHERE question_id = ?',
        [questionId]
    );
    const nextRev = (maxRow[0].max_rev || 0) + 1;

    await conn.execute(
        `INSERT INTO question_revisions (question_id, revision_number, snapshot, change_note, changed_by)
         VALUES (?, ?, ?, ?, ?)`,
        [questionId, nextRev, JSON.stringify(snapshot), changeNote || null, changedBy || null]
    );
}

async function listRevisions(questionId) {
    const [rows] = await pool.query(
        `SELECT id, revision_number, change_note, changed_by, created_at
         FROM question_revisions
         WHERE question_id = ?
         ORDER BY revision_number DESC`,
        [questionId]
    );
    return rows;
}

async function getRevision(questionId, revisionNumber) {
    const [rows] = await pool.query(
        `SELECT * FROM question_revisions
         WHERE question_id = ? AND revision_number = ?`,
        [questionId, revisionNumber]
    );
    if (!rows[0]) return null;
    const row = rows[0];
    return {
        ...row,
        snapshot: typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot
    };
}

// =====================================================================
// CREATE / UPDATE / DELETE
// =====================================================================

async function create(payload, userId = null) {
    // Ambil created_by dari payload jika userId tidak diberikan
    if (!userId && payload.created_by) userId = payload.created_by;
    // create harus selalu punya kategori
    if (!Array.isArray(payload.collections) || payload.collections.length === 0) {
        throw new Error('Kategori soal wajib dipilih');
    }
    validatePayload(payload);

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.execute(
            `INSERT INTO questions
                (category_id, type, content, explanation, general_feedback, difficulty,
                 default_marks, penalty, shuffle_options, try_penalty, created_by, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
                payload.category_id || null,
                payload.type,
                payload.content,
                payload.explanation || null,
                payload.general_feedback || null,
                payload.difficulty || 'medium',
                payload.default_marks ?? 1.0,
                payload.penalty ?? 0.0,
                payload.shuffle_options ? 1 : 0,
                payload.try_penalty ?? 0.0,
                userId
            ]
        );
        const questionId = result.insertId;

        await replaceOptions(conn, questionId, payload.options);
        await replaceAnswers(conn, questionId, payload.answers);
        await replaceImages(conn, questionId, payload.images);
        await replaceHints(conn, questionId, payload.hints);
        await replaceTags(conn, questionId, payload.tags);
        await replaceCollections(conn, questionId, payload.collections, userId);
        await saveRevision(conn, questionId, payload.change_note || 'Created', userId);

        await conn.commit();
        return getById(questionId);
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

async function update(id, payload, userId = null) {
    const existing = await getById(id);
    if (!existing) throw new Error('Soal tidak ditemukan');

    validatePayload({ ...payload, type: payload.type || existing.type });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const fields = [];
        const values = [];
        const editableFields = [
            'category_id', 'type', 'content', 'explanation', 'general_feedback',
            'difficulty', 'default_marks', 'penalty',
            'shuffle_options', 'try_penalty', 'is_active'
        ];

        editableFields.forEach(key => {
            if (payload[key] !== undefined) {
                if (key === 'shuffle_options') {
                    fields.push(`${key} = ?`);
                    values.push(payload[key] ? 1 : 0);
                } else {
                    fields.push(`${key} = ?`);
                    values.push(payload[key]);
                }
            }
        });

        if (fields.length) {
            values.push(id);
            await conn.execute(
                `UPDATE questions SET ${fields.join(', ')} WHERE id = ?`,
                values
            );
        }

        if (Array.isArray(payload.options)) await replaceOptions(conn, id, payload.options);
        if (Array.isArray(payload.answers)) await replaceAnswers(conn, id, payload.answers);
        if (Array.isArray(payload.images)) await replaceImages(conn, id, payload.images);
        if (Array.isArray(payload.hints)) await replaceHints(conn, id, payload.hints);
        if (Array.isArray(payload.tags)) await replaceTags(conn, id, payload.tags);
        if (Array.isArray(payload.collections)) await replaceCollections(conn, id, payload.collections, userId);

        await saveRevision(conn, id, payload.change_note || 'Updated', userId);

        await conn.commit();
        return getById(id);
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

async function remove(id) {
    await pool.execute('UPDATE questions SET is_active = 0 WHERE id = ?', [id]);
    return true;
}

module.exports = {
    QUESTION_TYPES,
    DIFFICULTIES,
    list,
    getById,
    create,
    update,
    remove,
    listRevisions,
    getRevision
};
