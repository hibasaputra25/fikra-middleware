const express = require('express');
const router = express.Router();
const collectionService = require('../services/collectionService');

router.get('/', async (req, res, next) => {
    try {
        const { search } = req.query;
        const data = search
            ? await collectionService.search(search)
            : await collectionService.listAll();
        res.json({ data, total: data.length });
    } catch (err) {
        next(err);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const data = await collectionService.getById(parseInt(req.params.id));
        if (!data) return res.status(404).json({ error: 'Collection tidak ditemukan' });
        res.json(data);
    } catch (err) {
        next(err);
    }
});

router.get('/:id/questions', async (req, res, next) => {
    try {
        const data = await collectionService.listQuestions(parseInt(req.params.id), {
            page: req.query.page ? parseInt(req.query.page) : 1,
            limit: req.query.limit ? Math.min(parseInt(req.query.limit), 100) : 20
        });
        res.json(data);
    } catch (err) {
        next(err);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const data = await collectionService.create(req.body);
        res.status(201).json(data);
    } catch (err) {
        if (err.message.includes('wajib')) return res.status(400).json({ error: err.message });
        next(err);
    }
});

router.put('/:id', async (req, res, next) => {
    try {
        const data = await collectionService.update(parseInt(req.params.id), req.body);
        res.json(data);
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', async (req, res, next) => {
    try {
        await collectionService.remove(parseInt(req.params.id));
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
