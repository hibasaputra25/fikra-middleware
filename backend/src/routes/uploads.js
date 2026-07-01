const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authMiddleware, requireRole } = require('../middleware/auth');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');
const QUESTION_DIR = path.join(UPLOAD_ROOT, 'questions');
const MATERI_DIR   = path.join(UPLOAD_ROOT, 'materi');

// Pastikan folder ada
fs.mkdirSync(QUESTION_DIR, { recursive: true });
fs.mkdirSync(MATERI_DIR,   { recursive: true });

const ALLOWED_MIME = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
]);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, QUESTION_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const name = crypto.randomBytes(12).toString('hex');
        cb(null, `${Date.now()}-${name}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: MAX_SIZE },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
            return cb(new Error('Tipe file tidak didukung. Hanya JPG, PNG, GIF, WEBP, SVG'));
        }
        cb(null, true);
    }
});

// =====================================================================
// MATERI upload config
// Format: PDF, DOCX, PPTX, JPG, PNG — max 10MB
// =====================================================================
const MATERI_ALLOWED_MIME = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
]);
const MATERI_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const materiStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, MATERI_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const name = crypto.randomBytes(12).toString('hex');
        cb(null, `${Date.now()}-${name}${ext}`);
    }
});

const uploadMateri = multer({
    storage: materiStorage,
    limits: { fileSize: MATERI_MAX_SIZE },
    fileFilter: (req, file, cb) => {
        if (!MATERI_ALLOWED_MIME.has(file.mimetype)) {
            return cb(new Error('Tipe file tidak didukung. Gunakan PDF, DOCX, PPTX, JPG, atau PNG'));
        }
        cb(null, true);
    }
});

// POST /api/uploads/materi  (field: file) — hanya guru & admin
router.post('/materi', authMiddleware, requireRole('guru', 'admin'), (req, res, next) => {
    uploadMateri.single('file')(req, res, (err) => {
        if (err) {
            const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
            return res.status(status).json({ error: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'File tidak ditemukan' });
        }

        const url = `/uploads/materi/${req.file.filename}`;
        res.status(201).json({
            url,
            filename: req.file.filename,
            original_name: req.file.originalname,
            size: req.file.size,
            mime: req.file.mimetype,
        });
    });
});

// DELETE /api/uploads/materi/:filename — hanya guru & admin
router.delete('/materi/:filename', authMiddleware, requireRole('guru', 'admin'), (req, res) => {
    const { filename } = req.params;
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
        return res.status(400).json({ error: 'Nama file tidak valid' });
    }

    const filePath = path.join(MATERI_DIR, filename);
    fs.unlink(filePath, (err) => {
        if (err && err.code !== 'ENOENT') {
            return res.status(500).json({ error: 'Gagal menghapus file' });
        }
        res.json({ success: true });
    });
});

// POST /api/uploads/question-image  (field: file) — hanya guru & admin
router.post('/question-image', authMiddleware, requireRole('guru', 'admin'), (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
            return res.status(status).json({ error: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'File tidak ditemukan' });
        }

        const url = `/uploads/questions/${req.file.filename}`;
        res.status(201).json({
            url,
            filename: req.file.filename,
            size: req.file.size,
            mime: req.file.mimetype
        });
    });
});

// DELETE /api/uploads/question-image/:filename — hanya guru & admin
router.delete('/question-image/:filename', authMiddleware, requireRole('guru', 'admin'), (req, res) => {
    const { filename } = req.params;
    // Cegah path traversal
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
        return res.status(400).json({ error: 'Nama file tidak valid' });
    }

    const filePath = path.join(QUESTION_DIR, filename);
    fs.unlink(filePath, (err) => {
        if (err && err.code !== 'ENOENT') {
            return res.status(500).json({ error: 'Gagal menghapus file' });
        }
        res.json({ success: true });
    });
});

module.exports = router;
