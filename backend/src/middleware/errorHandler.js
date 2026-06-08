function errorHandler(err, req, res, next) {
    console.error(`❌ [${new Date().toISOString()}] ${req.method} ${req.path}:`, err.message);

    if (err.message.includes('Moodle API Error')) {
        return res.status(502).json({
            error: 'Gagal mengambil data dari Moodle',
            detail: err.message
        });
    }

    if (err.message.includes('Tidak ada mapping')) {
        return res.status(404).json({
            error: err.message
        });
    }

    return res.status(500).json({
        error: 'Internal server error',
        detail: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
}

module.exports = { errorHandler };