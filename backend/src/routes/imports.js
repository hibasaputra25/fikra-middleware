const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { importQuestions, getImportLogs } = require('../services/importService');

// Simpan file di memory (tidak perlu disk)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        const allowed = [
            'text/xml', 'application/xml',
            'text/csv', 'application/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/octet-stream'
        ];
        const ext = file.originalname.split('.').pop().toLowerCase();
        const allowedExt = ['xml', 'csv', 'xlsx', 'xls'];
        if (allowedExt.includes(ext)) return cb(null, true);
        cb(new Error('Format file tidak didukung. Gunakan .xml, .csv, atau .xlsx'));
    }
});

/**
 * Deteksi format dari nama file
 */
function detectFormat(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'xml')  return 'moodle_xml';
    if (ext === 'csv')  return 'csv';
    if (ext === 'xlsx' || ext === 'xls') return 'excel';
    return null;
}

// POST /api/imports/questions
// Upload dan import soal
router.post(
    '/questions',
    authMiddleware,
    requireRole('admin', 'guru'),
    upload.single('file'),
    async (req, res, next) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'File wajib diunggah' });
            }

            const filename         = req.file.originalname;
            const format           = req.body.format || detectFormat(filename);
            const overrideCategoryId = req.body.category_id
                ? parseInt(req.body.category_id)
                : null;
            const collectionId = req.body.collection_id
                ? parseInt(req.body.collection_id)
                : null;

            if (!format) {
                return res.status(400).json({
                    error: 'Format tidak dikenali. Gunakan file .xml, .csv, atau .xlsx'
                });
            }

            const result = await importQuestions({
                buffer:             req.file.buffer,
                filename,
                format,
                overrideCategoryId,
                collectionId,
                createdBy:          req.user.id
            });

            const statusCode = result.total_inserted === 0 ? 422 : 201;
            res.status(statusCode).json({
                success:        result.total_inserted > 0,
                filename,
                format,
                total_parsed:   result.total_parsed,
                total_inserted: result.total_inserted,
                total_skipped:  result.total_skipped,
                total_errors:   result.total_errors,
                errors:         result.errors
            });
        } catch (err) {
            if (err.message.includes('Format file')) {
                return res.status(400).json({ error: err.message });
            }
            next(err);
        }
    }
);

// GET /api/imports/logs
// Riwayat import
router.get(
    '/logs',
    authMiddleware,
    requireRole('admin', 'guru'),
    async (req, res, next) => {
        try {
            const limit = Math.min(50, parseInt(req.query.limit || '20'));
            const logs  = await getImportLogs(limit);
            res.json({ data: logs, total: logs.length });
        } catch (err) {
            next(err);
        }
    }
);

// GET /api/imports/template/csv
// Download template CSV
router.get('/template/csv', authMiddleware, (req, res) => {
    const header = [
        'type', 'content', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e',
        'correct_answer', 'explanation', 'difficulty', 'category', 'default_marks',
        'penalty', 'tolerance'
    ].join(',');

    const example = [
        'multichoice',
        '"Berapa hasil dari 2 + 2?"',
        '3', '4', '5', '6', '',
        'B',
        '"2 + 2 = 4"',
        'easy',
        'PM',
        '1', '0', ''
    ].join(',');

    const csv = `${header}\n${example}\n`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-soal.csv"');
    res.send(csv);
});

module.exports = router;
