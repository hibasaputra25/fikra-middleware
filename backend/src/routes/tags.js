const express = require('express');
const router = express.Router();
const tagService = require('../services/tagService');

// GET /api/tags?search=...
router.get('/', async (req, res, next) => {
    try {
        const { search } = req.query;
        const data = search
            ? await tagService.search(search)
            : await tagService.listAll();
        res.json({ data, total: data.length });
    } catch (err) {
        next(err);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const tag = await tagService.getById(parseInt(req.params.id));
        if (!tag) return res.status(404).json({ error: 'Tag tidak ditemukan' });
        res.json(tag);
    } catch (err) {
        next(err);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const tag = await tagService.create(req.body);
        res.status(201).json(tag);
    } catch (err) {
        if (err.message.includes('wajib') || err.message.includes('serupa')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
});

router.put('/:id', async (req, res, next) => {
    try {
        const tag = await tagService.update(parseInt(req.params.id), req.body);
        res.json(tag);
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', async (req, res, next) => {
    try {
        await tagService.remove(parseInt(req.params.id));
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
