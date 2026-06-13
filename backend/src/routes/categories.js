const express = require('express');
const router = express.Router();
const categoryService = require('../services/categoryService');

// GET /api/categories?level=subtes&parent_id=1&tree=1
router.get('/', async (req, res, next) => {
    try {
        const { level, parent_id, tree } = req.query;

        if (tree === '1' || tree === 'true') {
            const data = await categoryService.listTree();
            return res.json({ data });
        }

        if (parent_id) {
            const data = await categoryService.listChildren(parseInt(parent_id));
            return res.json({ data, total: data.length });
        }

        if (level) {
            const data = await categoryService.listByLevel(level);
            return res.json({ data, total: data.length });
        }

        const data = await categoryService.listAll();
        res.json({ data, total: data.length });
    } catch (err) {
        next(err);
    }
});

// GET /api/categories/:id
router.get('/:id', async (req, res, next) => {
    try {
        const cat = await categoryService.getById(parseInt(req.params.id));
        if (!cat) return res.status(404).json({ error: 'Kategori tidak ditemukan' });
        res.json(cat);
    } catch (err) {
        next(err);
    }
});

// POST /api/categories
router.post('/', async (req, res, next) => {
    try {
        const cat = await categoryService.create(req.body);
        res.status(201).json(cat);
    } catch (err) {
        if (err.message.includes('wajib')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
});

// PUT /api/categories/:id
router.put('/:id', async (req, res, next) => {
    try {
        const cat = await categoryService.update(parseInt(req.params.id), req.body);
        res.json(cat);
    } catch (err) {
        next(err);
    }
});

// DELETE /api/categories/:id (soft delete)
router.delete('/:id', async (req, res, next) => {
    try {
        await categoryService.remove(parseInt(req.params.id));
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
