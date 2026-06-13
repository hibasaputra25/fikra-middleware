const express = require('express');
const router = express.Router();
const questionService = require('../services/questionService');

// GET /api/questions?category_id=1&type=mcq_single&difficulty=medium&search=...&page=1&limit=20
router.get('/', async (req, res, next) => {
    try {
        const result = await questionService.list({
            category_id: req.query.category_id ? parseInt(req.query.category_id) : undefined,
            type: req.query.type,
            difficulty: req.query.difficulty,
            search: req.query.search,
            tag_id: req.query.tag_id ? parseInt(req.query.tag_id) : undefined,
            collection_id: req.query.collection_id ? parseInt(req.query.collection_id) : undefined,
            page: req.query.page ? parseInt(req.query.page) : 1,
            limit: req.query.limit ? Math.min(parseInt(req.query.limit), 100) : 20
        });
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// GET /api/questions/meta — info untuk form (tipe & difficulty options)
router.get('/meta', (req, res) => {
    res.json({
        types: questionService.QUESTION_TYPES,
        difficulties: questionService.DIFFICULTIES
    });
});

// GET /api/questions/:id/revisions
router.get('/:id/revisions', async (req, res, next) => {
    try {
        const data = await questionService.listRevisions(parseInt(req.params.id));
        res.json({ data, total: data.length });
    } catch (err) {
        next(err);
    }
});

// GET /api/questions/:id/revisions/:rev
router.get('/:id/revisions/:rev', async (req, res, next) => {
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
router.get('/:id', async (req, res, next) => {
    try {
        const question = await questionService.getById(parseInt(req.params.id));
        if (!question) return res.status(404).json({ error: 'Soal tidak ditemukan' });
        res.json(question);
    } catch (err) {
        next(err);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const question = await questionService.create(req.body);
        res.status(201).json(question);
    } catch (err) {
        if (err.message.includes('wajib') || err.message.includes('minimal')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
});

router.put('/:id', async (req, res, next) => {
    try {
        const question = await questionService.update(parseInt(req.params.id), req.body);
        res.json(question);
    } catch (err) {
        if (err.message.includes('wajib') || err.message.includes('minimal') || err.message.includes('tidak ditemukan')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
});

// DELETE /api/questions/:id (soft delete)
router.delete('/:id', async (req, res, next) => {
    try {
        await questionService.remove(parseInt(req.params.id));
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
