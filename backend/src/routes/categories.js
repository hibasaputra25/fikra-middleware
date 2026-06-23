const express = require('express');
const router = express.Router();
const categoryService = require('../services/categoryService');
const { authMiddleware } = require('../middleware/auth');

// GET /api/categories?level=subtes&parent_id=1&tree=1&kurikulum_id=11
router.get('/', async (req, res, next) => {
    try {
        const { level, parent_id, tree, kurikulum_id } = req.query;

        if (tree === '1' || tree === 'true') {
            const data = await categoryService.listTree();
            return res.json({ data });
        }

        // Tree untuk satu kurikulum
        if (kurikulum_id) {
            const data = await categoryService.listTreeByKurikulum(parseInt(kurikulum_id));
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

// GET /api/categories/kurikulum — semua kurikulum (root)
router.get('/kurikulum', async (req, res, next) => {
    try {
        const data = await categoryService.listKurikulum();
        res.json({ data });
    } catch (err) { next(err); }
});

// GET /api/categories/guru/kurikulum — kurikulum yang ditugaskan ke guru yang login
router.get('/guru/kurikulum', authMiddleware, async (req, res, next) => {
    try {
        const data = await categoryService.getKurikulumByGuru(req.user.id);
        res.json({ data });
    } catch (err) { next(err); }
});

// GET /api/categories/guru/:userId/kurikulum — kurikulum guru tertentu (admin)
router.get('/guru/:userId/kurikulum', async (req, res, next) => {
    try {
        const data = await categoryService.getKurikulumByGuru(parseInt(req.params.userId));
        res.json({ data });
    } catch (err) { next(err); }
});

// PUT /api/categories/guru/:userId/kurikulum — set kurikulum untuk guru (admin)
router.put('/guru/:userId/kurikulum', async (req, res, next) => {
    try {
        const { kurikulum_ids } = req.body;
        await categoryService.setKurikulumGuru(parseInt(req.params.userId), kurikulum_ids || []);
        const data = await categoryService.getKurikulumByGuru(parseInt(req.params.userId));
        res.json({ data });
    } catch (err) { next(err); }
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
