const { verifyAccessToken } = require('../services/authService');

// Middleware verifikasi JWT lokal
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token tidak ditemukan' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = verifyAccessToken(token);
        req.user = {
            id: payload.sub || payload.id,
            username: payload.username,
            nama: payload.nama || payload.name,
            role: payload.role,
            email: payload.email
        };
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token sudah expired', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ error: 'Token tidak valid' });
    }
}

// Middleware cek role — gunakan setelah authMiddleware
// Contoh: requireRole('admin'), requireRole('admin', 'guru')
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Tidak terautentikasi' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: `Akses ditolak. Diperlukan role: ${roles.join(' atau ')}`
            });
        }
        next();
    };
}

module.exports = { authMiddleware, requireRole };
