require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { testConnection } = require('./src/config/db');
const { errorHandler } = require('./src/middleware/errorHandler');

// Routes
const authRoutes = require('./src/routes/auth');
const quizzesRoutes = require('./src/routes/quizzes');
const studentsRoutes = require('./src/routes/students');
const resultsRoutes = require('./src/routes/results');
const chatRoutes = require('./src/routes/chat');
const categoriesRoutes = require('./src/routes/categories');
const questionsRoutes = require('./src/routes/questions');
const uploadsRoutes = require('./src/routes/uploads');
const tagsRoutes = require('./src/routes/tags');
const collectionsRoutes = require('./src/routes/collections');
const quizPlayerRoutes = require('./src/routes/quizPlayer');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' } // izinkan FE load gambar
}));
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Static: serve folder uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: '7d',
    fallthrough: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 100,
    message: { error: 'Terlalu banyak request, coba lagi nanti' }
});

const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 menit
    max: 20,
    message: { error: 'Terlalu banyak pesan ke Kak Fikra, tunggu sebentar ya!' }
});

app.use(limiter);
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Fikra Academy Backend'
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/chat', chatLimiter, chatRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/collections', collectionsRoutes);
app.use('/api/quiz-player', quizPlayerRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} tidak ditemukan` });
});

// Error handler
app.use(errorHandler);

// Start server
async function start() {
    await testConnection();
    app.listen(PORT, () => {
        console.log(`🚀 Fikra Academy Backend running on port ${PORT}`);
        console.log(`📡 Moodle URL: ${process.env.MOODLE_URL}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}

start().catch(err => {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
});