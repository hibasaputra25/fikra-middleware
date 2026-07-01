const express = require('express');
const router  = express.Router();
const { pool } = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Shorthand: autentikasi + hanya guru & admin
const adminOnly = [authMiddleware, requireRole('guru', 'admin')];

// GET /api/quizzes
// List semua tryout yang published
// Siswa: hanya tryout yang sesuai jenjangnya (via user_jenjang)
// Guru/Admin: semua tryout published
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;

        let whereExtra = '';
        const extraParams = [];

        if (role === 'guru') {
            whereExtra = `
                AND (
                    NOT EXISTS (
                        SELECT 1 FROM guru_kurikulum gk WHERE gk.user_id = ?
                    )
                    OR EXISTS (
                        SELECT 1 FROM tryout_sections ts4
                        JOIN categories c4 ON c4.id = ts4.category_id
                        WHERE ts4.tryout_id = t.id
                        AND c4.parent_id IN (
                            SELECT kurikulum_id FROM guru_kurikulum WHERE user_id = ?
                        )
                    )
                    OR NOT EXISTS (
                        SELECT 1 FROM tryout_sections ts5
                        JOIN categories c5 ON c5.id = ts5.category_id
                        WHERE ts5.tryout_id = t.id
                    )
                )
            `;
            extraParams.push(userId, userId);
        } else if (role === 'siswa') {
            whereExtra = `
                AND (
                    NOT EXISTS (
                        SELECT 1 FROM tryout_sections ts2
                        JOIN categories c2 ON c2.id = ts2.category_id
                        WHERE ts2.tryout_id = t.id
                    )
                    OR EXISTS (
                        SELECT 1 FROM tryout_sections ts3
                        JOIN categories c3 ON c3.id = ts3.category_id
                        WHERE ts3.tryout_id = t.id
                        AND c3.parent_id IN (
                            SELECT kurikulum_id FROM user_jenjang WHERE user_id = ?
                        )
                    )
                )
            `;
            extraParams.push(userId);
        }

        const [rows] = await pool.execute(`
            SELECT
                t.id, t.name, t.description, t.type,
                t.duration_minutes, t.start_at, t.end_at,
                t.max_attempts, t.shuffle_questions, t.shuffle_options,
                t.show_review, t.show_explanation, t.passing_score,
                t.status, t.created_at,
                COUNT(DISTINCT ts.id)   AS section_count,
                SUM(ts.total_questions) AS total_questions
            FROM tryouts t
            LEFT JOIN tryout_sections ts ON ts.tryout_id = t.id
            WHERE t.status = 'published' ${whereExtra}
            GROUP BY t.id
            ORDER BY t.start_at DESC, t.created_at DESC
        `, extraParams);

        const now = new Date();
        const data = rows.map(t => ({ ...t, status_jadwal: getStatusJadwal(t, now) }));

        // Inject user_attempt info (in_progress + completed_count)
        if (data.length > 0 && userId) {
            const tryoutIds = data.map(t => t.id);
            const ph = tryoutIds.map(() => '?').join(',');

            const [activeAttempts] = await pool.execute(
                `SELECT tryout_id, id, due_at, started_at
                 FROM tryout_attempts
                 WHERE tryout_id IN (${ph}) AND user_id = ? AND status = 'in_progress'
                 ORDER BY id DESC`,
                [...tryoutIds, userId]
            );
            const activeMap = {};
            for (const a of activeAttempts) {
                if (activeMap[a.tryout_id]) continue;
                if (a.due_at && now > new Date(a.due_at)) continue;
                activeMap[a.tryout_id] = {
                    id: a.id,
                    started_at: a.started_at,
                    time_left_seconds: a.due_at
                        ? Math.max(0, Math.floor((new Date(a.due_at) - now) / 1000))
                        : null
                };
            }

            const [completed] = await pool.execute(
                `SELECT tryout_id, COUNT(*) as total, MAX(total_score) as best_score
                 FROM tryout_attempts
                 WHERE tryout_id IN (${ph}) AND user_id = ? AND status = 'submitted'
                 GROUP BY tryout_id`,
                [...tryoutIds, userId]
            );
            const completedMap = {};
            completed.forEach(c => { completedMap[c.tryout_id] = { total: c.total, best_score: c.best_score }; });

            data.forEach(t => {
                t.active_attempt    = activeMap[t.id] || null;
                t.completed_count   = completedMap[t.id]?.total || 0;
                t.best_score        = completedMap[t.id]?.best_score || null;
            });
        }

        res.json({ total: data.length, data });
    } catch (err) { next(err); }
});

// GET /api/quizzes/admin/all
// List semua tryout (termasuk draft) untuk admin/guru
router.get('/admin/all', adminOnly, async (req, res, next) => {
    try {
        const [rows] = await pool.execute(`
            SELECT
                t.id, t.name, t.description, t.type, t.status,
                t.duration_minutes, t.start_at, t.end_at, t.created_at,
                COUNT(DISTINCT ts.id) AS section_count,
                COALESCE((
                    SELECT SUM(tsq2.total_count)
                    FROM (
                        SELECT ts2.id, COUNT(tsq.id) AS total_count
                        FROM tryout_sections ts2
                        LEFT JOIN tryout_section_questions tsq ON tsq.section_id = ts2.id
                        WHERE ts2.tryout_id = t.id
                        GROUP BY ts2.id
                    ) tsq2
                ), 0) AS total_questions
            FROM tryouts t
            LEFT JOIN tryout_sections ts ON ts.tryout_id = t.id
            GROUP BY t.id
            ORDER BY t.created_at DESC
        `);
        res.json({ total: rows.length, data: rows });
    } catch (err) { next(err); }
});

// POST /api/quizzes/admin
// Buat tryout baru
router.post('/admin', adminOnly, async (req, res, next) => {
    try {
        const { name, type = 'custom', duration_minutes, start_at, end_at } = req.body;
        if (!name) return res.status(400).json({ error: 'Nama tryout wajib diisi' });
        const [result] = await pool.execute(
            `INSERT INTO tryouts (name, type, duration_minutes, start_at, end_at, status, created_by)
             VALUES (?, ?, ?, ?, ?, 'draft', ?)`,
            [name, type, duration_minutes || null, start_at || null, end_at || null, req.user.id]
        );
        const [[tryout]] = await pool.execute('SELECT * FROM tryouts WHERE id = ?', [result.insertId]);
        // Buat satu section default
        await pool.execute(
            `INSERT INTO tryout_sections (tryout_id, name, sort_order, total_questions) VALUES (?, 'Semua Soal', 1, 0)`,
            [result.insertId]
        );
        res.status(201).json(tryout);
    } catch (err) { next(err); }
});

// GET /api/quizzes/admin/:id/sections
// List sections dari satu tryout
router.get('/admin/:id/sections', adminOnly, async (req, res, next) => {
    try {
        const [sections] = await pool.execute(
            `SELECT id, name, sort_order, total_questions FROM tryout_sections
             WHERE tryout_id = ? ORDER BY sort_order ASC`,
            [parseInt(req.params.id)]
        );
        res.json({ data: sections });
    } catch (err) { next(err); }
});

// POST /api/quizzes/admin/section/:sectionId/questions/append
// Tambah soal ke section tryout (tanpa hapus yang sudah ada)
router.post('/admin/section/:sectionId/questions/append', adminOnly, async (req, res, next) => {
    try {
        const sectionId = parseInt(req.params.sectionId);
        const { question_ids } = req.body;

        if (!Array.isArray(question_ids) || question_ids.length === 0) {
            return res.status(400).json({ error: 'question_ids harus berupa array tidak kosong' });
        }

        // Ambil sort_order tertinggi
        const [[{ maxOrder }]] = await pool.execute(
            'SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM tryout_section_questions WHERE section_id = ?',
            [sectionId]
        );

        // Ambil tryout_id dari section
        const [[section]] = await pool.execute(
            'SELECT tryout_id FROM tryout_sections WHERE id = ?',
            [sectionId]
        );
        if (!section) return res.status(404).json({ error: 'Section tidak ditemukan' });

        let added = 0;
        for (let i = 0; i < question_ids.length; i++) {
            const qId = parseInt(question_ids[i]);
            try {
                await pool.execute(
                    `INSERT IGNORE INTO tryout_section_questions
                     (section_id, question_id, sort_order, marks, penalty)
                     VALUES (?, ?, ?, 1.00, 0.00)`,
                    [sectionId, qId, maxOrder + i + 1]
                );
                added++;
            } catch { /* skip duplikat */ }
        }

        // Update total_questions di section
        await pool.execute(
            'UPDATE tryout_sections SET total_questions = (SELECT COUNT(*) FROM tryout_section_questions WHERE section_id = ?) WHERE id = ?',
            [sectionId, sectionId]
        );

        res.json({ success: true, added });
    } catch (err) { next(err); }
});

// ─── ADMIN DETAIL ROUTES ─────────────────────────────────────────────────────

// GET /api/quizzes/admin/:id
// Detail lengkap tryout: metadata + sections + soal per section
router.get('/admin/:id', adminOnly, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const [[tryout]] = await pool.execute('SELECT * FROM tryouts WHERE id = ?', [id]);
        if (!tryout) return res.status(404).json({ error: 'Tryout tidak ditemukan' });

        // Sections
        const [sections] = await pool.execute(
            `SELECT id, name, sort_order, duration_minutes, category_id,
                    (SELECT COUNT(*) FROM tryout_section_questions WHERE section_id = ts.id) AS total_questions
             FROM tryout_sections ts WHERE tryout_id = ? ORDER BY sort_order ASC`,
            [id]
        );

        // Soal per section
        for (const section of sections) {
            const [questions] = await pool.execute(
                `SELECT tsq.id AS tsq_id, tsq.question_id, tsq.sort_order, tsq.marks, tsq.penalty,
                        q.type, q.difficulty, q.content, q.explanation,
                        LEFT(q.content, 150) AS content_preview,
                        c.code AS category_code, c.name AS category_name
                 FROM tryout_section_questions tsq
                 JOIN questions q ON q.id = tsq.question_id
                 LEFT JOIN categories c ON c.id = q.category_id
                 WHERE tsq.section_id = ?
                 ORDER BY tsq.sort_order ASC`,
                [section.id]
            );

            // Ambil opsi per soal (dengan is_correct untuk preview guru)
            if (questions.length > 0) {
                const qIds = questions.map(q => q.question_id);
                const ph   = qIds.map(() => '?').join(',');
                const [options] = await pool.execute(
                    `SELECT id, question_id, content, is_correct, sort_order
                     FROM question_options WHERE question_id IN (${ph}) ORDER BY sort_order ASC`,
                    qIds
                );
                const optMap = {};
                options.forEach(o => {
                    if (!optMap[o.question_id]) optMap[o.question_id] = [];
                    optMap[o.question_id].push(o);
                });
                questions.forEach(q => { q.options = optMap[q.question_id] || []; });
            }

            section.questions = questions;
        }

        res.json({ ...tryout, sections });
    } catch (err) { next(err); }
});

// PUT /api/quizzes/admin/:id
// Update metadata tryout (settings)
router.put('/admin/:id', adminOnly, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const allowed = ['name','type','status','duration_minutes','start_at','end_at',
                         'max_attempts','shuffle_questions','shuffle_options',
                         'show_review','show_explanation','passing_score','description'];
        const fields = [];
        const params = [];
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                fields.push(`${key} = ?`);
                params.push(req.body[key]);
            }
        }
        if (fields.length === 0) return res.status(400).json({ error: 'Tidak ada data yang diupdate' });
        params.push(id);
        await pool.execute(`UPDATE tryouts SET ${fields.join(', ')} WHERE id = ?`, params);
        const [[tryout]] = await pool.execute('SELECT * FROM tryouts WHERE id = ?', [id]);
        res.json(tryout);
    } catch (err) { next(err); }
});

// DELETE /api/quizzes/admin/:id
// Hapus tryout
router.delete('/admin/:id', adminOnly, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        await pool.execute('DELETE FROM tryouts WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) { next(err); }
});

// POST /api/quizzes/admin/:id/sections
// Tambah section baru ke tryout
router.post('/admin/:id/sections', adminOnly, async (req, res, next) => {
    try {
        const tryoutId = parseInt(req.params.id);
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Nama section wajib diisi' });
        const [[{ maxOrder }]] = await pool.execute(
            'SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM tryout_sections WHERE tryout_id = ?',
            [tryoutId]
        );
        const [result] = await pool.execute(
            `INSERT INTO tryout_sections (tryout_id, name, sort_order, total_questions) VALUES (?, ?, ?, 0)`,
            [tryoutId, name, maxOrder + 1]
        );
        const [[section]] = await pool.execute('SELECT * FROM tryout_sections WHERE id = ?', [result.insertId]);
        res.status(201).json(section);
    } catch (err) { next(err); }
});

// PUT /api/quizzes/admin/section/:sectionId
// Rename section
router.put('/admin/section/:sectionId', adminOnly, async (req, res, next) => {
    try {
        const sectionId = parseInt(req.params.sectionId);
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Nama section wajib diisi' });
        await pool.execute('UPDATE tryout_sections SET name = ? WHERE id = ?', [name, sectionId]);
        res.json({ success: true });
    } catch (err) { next(err); }
});

// DELETE /api/quizzes/admin/section/:sectionId
// Hapus section (cascade ke soal di section)
router.delete('/admin/section/:sectionId', adminOnly, async (req, res, next) => {
    try {
        const sectionId = parseInt(req.params.sectionId);
        await pool.execute('DELETE FROM tryout_sections WHERE id = ?', [sectionId]);
        res.json({ success: true });
    } catch (err) { next(err); }
});

// DELETE /api/quizzes/admin/section/:sectionId/questions/:questionId
// Hapus satu soal dari section
router.delete('/admin/section/:sectionId/questions/:questionId', adminOnly, async (req, res, next) => {
    try {
        const sectionId  = parseInt(req.params.sectionId);
        const questionId = parseInt(req.params.questionId);
        await pool.execute(
            'DELETE FROM tryout_section_questions WHERE section_id = ? AND question_id = ?',
            [sectionId, questionId]
        );
        // Update total_questions
        await pool.execute(
            'UPDATE tryout_sections SET total_questions = (SELECT COUNT(*) FROM tryout_section_questions WHERE section_id = ?) WHERE id = ?',
            [sectionId, sectionId]
        );
        res.json({ success: true });
    } catch (err) { next(err); }
});

// PUT /api/quizzes/admin/section/:sectionId/questions/:questionId
// Update marks/penalty/sort_order satu soal di section
router.put('/admin/section/:sectionId/questions/:questionId', adminOnly, async (req, res, next) => {
    try {
        const sectionId  = parseInt(req.params.sectionId);
        const questionId = parseInt(req.params.questionId);
        const { marks, penalty, sort_order } = req.body;
        const fields = [];
        const params = [];
        if (marks      !== undefined) { fields.push('marks = ?');      params.push(marks); }
        if (penalty    !== undefined) { fields.push('penalty = ?');    params.push(penalty); }
        if (sort_order !== undefined) { fields.push('sort_order = ?'); params.push(sort_order); }
        if (fields.length === 0) return res.status(400).json({ error: 'Tidak ada data' });
        params.push(sectionId, questionId);
        await pool.execute(
            `UPDATE tryout_section_questions SET ${fields.join(', ')} WHERE section_id = ? AND question_id = ?`,
            params
        );
        res.json({ success: true });
    } catch (err) { next(err); }
});

// GET /api/quizzes/admin/:id/attempts
// List semua attempts untuk monitoring (admin)
router.get('/admin/:id/attempts', adminOnly, async (req, res, next) => {
    try {
        const tryoutId = parseInt(req.params.id);
        const [attempts] = await pool.execute(`
            SELECT
                ta.id, ta.user_id, ta.attempt_number, ta.status,
                ta.started_at, ta.finished_at, ta.time_spent_seconds,
                ta.total_score, ta.due_at,
                u.nama, u.username
            FROM tryout_attempts ta
            JOIN users u ON u.id = ta.user_id
            WHERE ta.tryout_id = ?
            ORDER BY ta.started_at DESC
        `, [tryoutId]);

        // Stats ringkas
        const total      = attempts.length;
        const submitted  = attempts.filter(a => a.status === 'submitted').length;
        const inProgress = attempts.filter(a => a.status === 'in_progress').length;
        const avgScore   = submitted > 0
            ? Math.round(attempts.filter(a => a.status === 'submitted')
                .reduce((s, a) => s + (Number(a.total_score) || 0), 0) / submitted)
            : null;

        res.json({ total, submitted, in_progress: inProgress, avg_score: avgScore, data: attempts });
    } catch (err) { next(err); }
});

// GET /api/quizzes/:id
// Detail satu tryout beserta sections
router.get('/:id', authMiddleware, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);

        const [[tryout]] = await pool.execute(
            `SELECT * FROM tryouts WHERE id = ? AND status = 'published'`,
            [id]
        );
        if (!tryout) return res.status(404).json({ error: 'Tryout tidak ditemukan' });

        const [sections] = await pool.execute(
            `SELECT id, name, sort_order, duration_minutes, total_questions
             FROM tryout_sections WHERE tryout_id = ? ORDER BY sort_order ASC`,
            [id]
        );

        res.json({
            ...tryout,
            status_jadwal: getStatusJadwal(tryout, new Date()),
            sections
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/quizzes/:id/active-attempt
// Cek apakah user punya attempt in_progress untuk tryout ini
router.get('/:id/active-attempt', authMiddleware, async (req, res, next) => {
    try {
        const tryoutId = parseInt(req.params.id);
        const userId = req.user.id;
        const now = new Date();

        const [[attempt]] = await pool.execute(
            `SELECT id, started_at, due_at, status, attempt_number
             FROM tryout_attempts
             WHERE tryout_id = ? AND user_id = ? AND status = 'in_progress'
             ORDER BY id DESC LIMIT 1`,
            [tryoutId, userId]
        );

        if (!attempt) {
            // Cek apakah sudah pernah selesai
            const [[submitted]] = await pool.execute(
                `SELECT COUNT(*) as total, MAX(total_score) as best_score, MAX(finished_at) as last_finished
                 FROM tryout_attempts
                 WHERE tryout_id = ? AND user_id = ? AND status = 'submitted'`,
                [tryoutId, userId]
            );
            return res.json({
                active: false,
                attempt: null,
                completed_count: submitted?.total || 0,
                best_score: submitted?.best_score || null,
                last_finished: submitted?.last_finished || null
            });
        }

        // Cek apakah waktu sudah habis
        if (attempt.due_at && now > new Date(attempt.due_at)) {
            await pool.execute(
                `UPDATE tryout_attempts SET status = 'expired' WHERE id = ?`,
                [attempt.id]
            );
            const [[submitted]] = await pool.execute(
                `SELECT COUNT(*) as total, MAX(total_score) as best_score, MAX(finished_at) as last_finished
                 FROM tryout_attempts
                 WHERE tryout_id = ? AND user_id = ? AND status = 'submitted'`,
                [tryoutId, userId]
            );
            return res.json({
                active: false,
                attempt: null,
                completed_count: submitted?.total || 0,
                best_score: submitted?.best_score || null,
                last_finished: submitted?.last_finished || null
            });
        }

        const time_left_seconds = attempt.due_at
            ? Math.max(0, Math.floor((new Date(attempt.due_at) - now) / 1000))
            : null;

        res.json({
            active: true,
            attempt: { ...attempt, time_left_seconds },
            completed_count: 0,
            best_score: null,
            last_finished: null
        });
    } catch (err) {
        next(err);
    }
});

// ─── TRYOUT PLAY ROUTES (siswa) ─────────────────────────────────────────────

// POST /api/quizzes/:id/start
// Mulai atau lanjutkan attempt tryout
router.post('/:id/start', authMiddleware, async (req, res, next) => {
    try {
        const tryoutId = parseInt(req.params.id);
        const userId   = req.user.id;

        // Cek tryout exist & published
        const [[tryout]] = await pool.execute(
            'SELECT * FROM tryouts WHERE id = ? AND status = \'published\'',
            [tryoutId]
        );
        if (!tryout) return res.status(404).json({ error: 'Tryout tidak ditemukan' });

        // Cek jadwal
        const now = new Date();
        if (tryout.start_at && now < new Date(tryout.start_at)) {
            return res.status(403).json({ error: 'Tryout belum dibuka' });
        }
        if (tryout.end_at && now > new Date(tryout.end_at)) {
            return res.status(403).json({ error: 'Tryout sudah ditutup' });
        }

        // Cek attempt yang masih in_progress
        const [[existing]] = await pool.execute(
            `SELECT * FROM tryout_attempts
             WHERE tryout_id = ? AND user_id = ? AND status = 'in_progress'
             ORDER BY id DESC LIMIT 1`,
            [tryoutId, userId]
        );

        if (existing) {
            // Cek apakah sudah expired
            if (existing.due_at && now > new Date(existing.due_at)) {
                await pool.execute(
                    `UPDATE tryout_attempts SET status = 'expired' WHERE id = ?`,
                    [existing.id]
                );
            } else {
                // Lanjutkan attempt yang ada
                const questions = await getTryoutQuestions(tryoutId, existing.id, !!tryout.shuffle_questions);
                const answers   = await getTryoutAnswers(existing.id);
                return res.json({ attempt: existing, questions, answers, is_new: false });
            }
        }

        // Cek max_attempts
        const [[{ attemptCount }]] = await pool.execute(
            `SELECT COUNT(*) as attemptCount FROM tryout_attempts
             WHERE tryout_id = ? AND user_id = ? AND status IN ('submitted', 'expired')`,
            [tryoutId, userId]
        );
        if (tryout.max_attempts > 0 && attemptCount >= tryout.max_attempts) {
            return res.status(403).json({ error: 'Sudah mencapai batas maksimal attempt' });
        }

        // Hitung attempt_number
        const nextAttempt = parseInt(attemptCount) + 1;

        const [result] = await pool.execute(
            `INSERT INTO tryout_attempts (tryout_id, user_id, attempt_number, status, started_at, due_at)
             VALUES (?, ?, ?, 'in_progress', NOW(), IF(? IS NULL, NULL, DATE_ADD(NOW(), INTERVAL ? MINUTE)))`,
            [tryoutId, userId, nextAttempt, tryout.duration_minutes || null, tryout.duration_minutes || null]
        );
        const attemptId = result.insertId;

        const [[attempt]] = await pool.execute(
            'SELECT * FROM tryout_attempts WHERE id = ?', [attemptId]
        );
        const questions = await getTryoutQuestions(tryoutId, attemptId, !!tryout.shuffle_questions);

        res.status(201).json({ attempt, questions, answers: [], is_new: true });
    } catch (err) { next(err); }
});

// POST /api/quizzes/attempt/:attemptId/answer
// Simpan jawaban satu soal (auto-save)
router.post('/attempt/:attemptId/answer', authMiddleware, async (req, res, next) => {
    try {
        const attemptId = parseInt(req.params.attemptId);
        const { question_id, section_id, selected_option_ids, answer_text, is_flagged } = req.body;

        // Validasi attempt milik user ini
        const [[attempt]] = await pool.execute(
            'SELECT * FROM tryout_attempts WHERE id = ? AND user_id = ?',
            [attemptId, req.user.id]
        );
        if (!attempt) return res.status(404).json({ error: 'Attempt tidak ditemukan' });
        if (attempt.status !== 'in_progress') return res.status(400).json({ error: 'Attempt sudah tidak aktif' });

        // Cek due_at
        if (attempt.due_at && new Date() > new Date(attempt.due_at)) {
            await pool.execute(
                `UPDATE tryout_attempts SET status = 'expired' WHERE id = ?`, [attemptId]
            );
            return res.status(403).json({ error: 'Waktu habis', code: 'TIME_EXPIRED' });
        }

        const answerJson = JSON.stringify({
            selected_options: selected_option_ids || [],
            text: answer_text || null,
        });

        await pool.execute(
            `INSERT INTO tryout_attempt_answers
             (attempt_id, section_id, question_id, answer, is_flagged, answered_at)
             VALUES (?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
                 answer = VALUES(answer),
                 is_flagged = VALUES(is_flagged),
                 answered_at = NOW()`,
            [attemptId, section_id, question_id, answerJson, is_flagged ? 1 : 0]
        );

        res.json({ success: true });
    } catch (err) { next(err); }
});

// POST /api/quizzes/attempt/:attemptId/submit
// Submit tryout (hitung skor)
router.post('/attempt/:attemptId/submit', authMiddleware, async (req, res, next) => {
    try {
        const attemptId = parseInt(req.params.attemptId);
        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            const [[attempt]] = await conn.execute(
                'SELECT * FROM tryout_attempts WHERE id = ? AND user_id = ? FOR UPDATE',
                [attemptId, req.user.id]
            );
            if (!attempt) { await conn.rollback(); return res.status(404).json({ error: 'Attempt tidak ditemukan' }); }
            if (attempt.status === 'submitted') { await conn.rollback(); return res.status(409).json({ error: 'Sudah disubmit', code: 'ALREADY_SUBMITTED' }); }

            // Grace period 60 detik
            if (attempt.due_at) {
                const deadline = new Date(new Date(attempt.due_at).getTime() + 60_000);
                if (new Date() > deadline) {
                    await conn.execute(`UPDATE tryout_attempts SET status = 'expired' WHERE id = ?`, [attemptId]);
                    await conn.commit();
                    return res.status(403).json({ error: 'Waktu habis', code: 'TIME_EXPIRED' });
                }
            }

            // Ambil semua soal tryout
            const [questions] = await conn.execute(
                `SELECT tsq.question_id, tsq.section_id, tsq.marks, tsq.penalty, q.type
                 FROM tryout_section_questions tsq
                 JOIN questions q ON q.id = tsq.question_id
                 JOIN tryout_sections ts ON ts.id = tsq.section_id
                 WHERE ts.tryout_id = ?`,
                [attempt.tryout_id]
            );

            // Jawaban siswa
            const [rawAnswers] = await conn.execute(
                'SELECT question_id, answer FROM tryout_attempt_answers WHERE attempt_id = ?',
                [attemptId]
            );
            const answerMap = {};
            rawAnswers.forEach(a => {
                const parsed = typeof a.answer === 'string' ? JSON.parse(a.answer) : (a.answer || {});
                answerMap[a.question_id] = parsed;
            });

            // Jawaban benar
            const qIds = questions.map(q => q.question_id);
            const ph   = qIds.map(() => '?').join(',');
            const [correctOpts] = qIds.length > 0 ? await conn.execute(
                `SELECT question_id, id FROM question_options WHERE question_id IN (${ph}) AND is_correct = 1`, qIds
            ) : [[]]; 

            const correctMap = {};
            correctOpts.forEach(o => {
                if (!correctMap[o.question_id]) correctMap[o.question_id] = [];
                correctMap[o.question_id].push(o.id);
            });

            // Hitung skor
            let totalMarks = 0, earnedMarks = 0;
            const sectionScores = {};

            for (const q of questions) {
                const marks   = parseFloat(q.marks) || 1;
                const penalty = parseFloat(q.penalty) || 0;
                const correct = correctMap[q.question_id] || [];
                const answer  = answerMap[q.question_id] || {};
                const selected = answer.selected_options || [];
                totalMarks += marks;

                let isCorrect = null;
                let earned    = 0;

                if (['mcq_single', 'true_false'].includes(q.type) && selected.length > 0) {
                    isCorrect = correct.includes(selected[0]) ? 1 : 0;
                    earned    = isCorrect ? marks : -penalty;
                } else if (q.type === 'mcq_multi' && selected.length > 0) {
                    const sel = new Set(selected);
                    const cor = new Set(correct);
                    const allRight = [...cor].every(id => sel.has(id)) && [...sel].every(id => cor.has(id));
                    const partRight = [...sel].filter(id => cor.has(id)).length > 0 && [...sel].filter(id => !cor.has(id)).length === 0;
                    if (allRight) { isCorrect = 1; earned = marks; }
                    else if (partRight) { isCorrect = 0; earned = (([...sel].filter(id => cor.has(id)).length / cor.size) * marks * 0.5); }
                    else { isCorrect = 0; earned = -penalty; }
                }

                earnedMarks += earned;

                await conn.execute(
                    `UPDATE tryout_attempt_answers SET is_correct = ?, marks_earned = ? WHERE attempt_id = ? AND question_id = ?`,
                    [isCorrect, earned, attemptId, q.question_id]
                );

                // Per section score
                const sid = q.section_id;
                if (!sectionScores[sid]) sectionScores[sid] = { correct: 0, total: 0, marks: 0 };
                sectionScores[sid].total++;
                sectionScores[sid].marks += marks;
                if (isCorrect === 1) sectionScores[sid].correct++;
            }

            const totalScore = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
            const timeSpent  = Math.round((Date.now() - new Date(attempt.started_at).getTime()) / 1000);

            await conn.execute(
                `UPDATE tryout_attempts
                 SET status = 'submitted', finished_at = NOW(),
                     total_score = ?, time_spent_seconds = ?, score_per_section = ?
                 WHERE id = ?`,
                [totalScore, timeSpent, JSON.stringify(sectionScores), attemptId]
            );

            await conn.commit();
            res.json({ success: true, total_score: totalScore, attempt_id: attemptId });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (err) { next(err); }
});

// GET /api/quizzes/attempt/:attemptId
// Hasil attempt untuk review
router.get('/attempt/:attemptId', authMiddleware, async (req, res, next) => {
    try {
        const attemptId = parseInt(req.params.attemptId);
        const [[attempt]] = await pool.execute(
            `SELECT ta.*, t.name AS tryout_name, t.show_review, t.show_explanation
             FROM tryout_attempts ta
             JOIN tryouts t ON t.id = ta.tryout_id
             WHERE ta.id = ? AND ta.user_id = ?`,
            [attemptId, req.user.id]
        );
        if (!attempt) return res.status(404).json({ error: 'Attempt tidak ditemukan' });

        const questions = await getTryoutQuestions(attempt.tryout_id, attemptId, false);
        const [answers] = await pool.execute(
            'SELECT * FROM tryout_attempt_answers WHERE attempt_id = ?', [attemptId]
        );
        const answerMap = {};
        answers.forEach(a => {
            const parsed = typeof a.answer === 'string' ? JSON.parse(a.answer) : (a.answer || {});
            answerMap[a.question_id] = { ...a, answer: parsed };
        });

        // Tambahkan jawaban ke questions jika show_review aktif
        const result = questions.map(q => ({
            ...q,
            student_answer: answerMap[q.question_id] || null,
        }));

        res.json({ attempt, questions: result });
    } catch (err) { next(err); }
});

// Helper: ambil soal tryout (flat, dengan opsi)
async function getTryoutQuestions(tryoutId, attemptId, shuffle) {
    const [sections] = await pool.execute(
        `SELECT id, name, sort_order FROM tryout_sections WHERE tryout_id = ? ORDER BY sort_order ASC`,
        [tryoutId]
    );

    const allQuestions = [];
    for (const section of sections) {
        let [qs] = await pool.execute(
            `SELECT tsq.question_id, tsq.section_id, tsq.sort_order, tsq.marks, tsq.penalty,
                    q.type, q.content, q.difficulty, q.explanation,
                    LEFT(q.content, 100) AS content_preview
             FROM tryout_section_questions tsq
             JOIN questions q ON q.id = tsq.question_id
             WHERE tsq.section_id = ?
             ORDER BY tsq.sort_order ASC`,
            [section.id]
        );

        if (shuffle) {
            for (let i = qs.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [qs[i], qs[j]] = [qs[j], qs[i]];
            }
        }

        // Ambil opsi (tanpa is_correct)
        const qIds = qs.map(q => q.question_id);
        if (qIds.length > 0) {
            const ph = qIds.map(() => '?').join(',');
            const [options] = await pool.execute(
                `SELECT id, question_id, content, sort_order FROM question_options WHERE question_id IN (${ph}) ORDER BY sort_order ASC`,
                qIds
            );
            const optMap = {};
            options.forEach(o => {
                if (!optMap[o.question_id]) optMap[o.question_id] = [];
                optMap[o.question_id].push(o);
            });
            qs.forEach(q => { q.options = optMap[q.question_id] || []; });
        }

        qs.forEach(q => { q.section_name = section.name; });
        allQuestions.push(...qs);
    }

    return allQuestions;
}

async function getTryoutAnswers(attemptId) {
    const [rows] = await pool.execute(
        'SELECT question_id, answer, is_flagged FROM tryout_attempt_answers WHERE attempt_id = ?',
        [attemptId]
    );
    return rows.map(r => ({
        question_id: r.question_id,
        answer: typeof r.answer === 'string' ? JSON.parse(r.answer) : (r.answer || {}),
        is_flagged: r.is_flagged,
    }));
}

function getStatusJadwal(tryout, now) {
    if (tryout.start_at && now < new Date(tryout.start_at)) return 'upcoming';
    if (tryout.end_at   && now > new Date(tryout.end_at))   return 'closed';
    return 'open';
}

module.exports = router;
