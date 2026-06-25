const express = require('express');
const router  = express.Router();
const questionService = require('../services/questionService');
const { authMiddleware, requireRole } = require('../middleware/auth');

// GET /api/questions
// Admin   : semua soal
// Guru    : hanya soal yang dibuat sendiri (created_by = req.user.id)
// Siswa   : tidak boleh akses bank soal langsung
router.get('/', authMiddleware, requireRole('admin', 'guru'), async (req, res, next) => {
    try {
        const isGuru    = req.user.role === 'guru';
        const createdBy = isGuru ? req.user.id : (req.query.created_by ? parseInt(req.query.created_by) : undefined);

        const result = await questionService.list({
            category_id:   req.query.category_id   ? parseInt(req.query.category_id)   : undefined,
            kurikulum_id:  req.query.kurikulum_id  ? parseInt(req.query.kurikulum_id)  : undefined,
            type:          req.query.type,
            difficulty:    req.query.difficulty,
            search:        req.query.search,
            tag_id:        req.query.tag_id        ? parseInt(req.query.tag_id)        : undefined,
            collection_id: req.query.collection_id ? parseInt(req.query.collection_id) : undefined,
            created_by:    createdBy,
            page:          req.query.page          ? parseInt(req.query.page)          : 1,
            limit:         req.query.limit         ? Math.min(parseInt(req.query.limit), 100) : 20
        });
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// GET /api/questions/meta — info untuk form (tipe & difficulty options)
router.get('/meta', authMiddleware, (req, res) => {
    res.json({
        types: questionService.QUESTION_TYPES,
        difficulties: questionService.DIFFICULTIES
    });
});

// GET /api/questions/:id/revisions
router.get('/:id/revisions', authMiddleware, requireRole('admin', 'guru'), async (req, res, next) => {
    try {
        const data = await questionService.listRevisions(parseInt(req.params.id));
        res.json({ data, total: data.length });
    } catch (err) {
        next(err);
    }
});

// GET /api/questions/:id/revisions/:rev
router.get('/:id/revisions/:rev', authMiddleware, requireRole('admin', 'guru'), async (req, res, next) => {
    try {
        const rev = await questionService.getRevision(
            parseInt(req.params.id),
            parseInt(req.params.rev)
        );
        if (!rev) return res.status(404).json({ error: 'Revisi tidak ditemukan' });
        res.json(rev);
    } catch (err) {
        next(err);
    }
});

// GET /api/questions/:id
// Guru hanya bisa lihat soal milik sendiri, admin bisa semua
router.get('/:id', authMiddleware, requireRole('admin', 'guru'), async (req, res, next) => {
    try {
        const question = await questionService.getById(parseInt(req.params.id));
        if (!question) return res.status(404).json({ error: 'Soal tidak ditemukan' });

        // Guru hanya bisa akses soal milik sendiri
        if (req.user.role === 'guru' && question.created_by !== req.user.id) {
            return res.status(403).json({ error: 'Akses ditolak' });
        }
        res.json(question);
    } catch (err) {
        next(err);
    }
});

// POST /api/questions
router.post('/', authMiddleware, requireRole('admin', 'guru'), async (req, res, next) => {
    try {
        // Otomatis set created_by ke user yang login
        const body = { ...req.body, created_by: req.user.id };
        const question = await questionService.create(body);
        res.status(201).json(question);
    } catch (err) {
        if (err.message.includes('wajib') || err.message.includes('minimal')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
});

// PUT /api/questions/:id
router.put('/:id', authMiddleware, requireRole('admin', 'guru'), async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);

        // Guru hanya bisa edit soal milik sendiri
        if (req.user.role === 'guru') {
            const existing = await questionService.getById(id);
            if (!existing) return res.status(404).json({ error: 'Soal tidak ditemukan' });
            if (existing.created_by !== req.user.id) {
                return res.status(403).json({ error: 'Akses ditolak: bukan soal Anda' });
            }
        }

        const question = await questionService.update(id, req.body);
        res.json(question);
    } catch (err) {
        if (err.message.includes('wajib') || err.message.includes('minimal') || err.message.includes('tidak ditemukan')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
});

// DELETE /api/questions/:id (soft delete)
router.delete('/:id', authMiddleware, requireRole('admin', 'guru'), async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);

        // Guru hanya bisa hapus soal milik sendiri
        if (req.user.role === 'guru') {
            const existing = await questionService.getById(id);
            if (!existing) return res.status(404).json({ error: 'Soal tidak ditemukan' });
            if (existing.created_by !== req.user.id) {
                return res.status(403).json({ error: 'Akses ditolak: bukan soal Anda' });
            }
        }

        await questionService.remove(id);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
