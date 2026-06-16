/**
 * Generate Moodle Web Service token via /login/token.php
 *
 * Cara pakai:
 *   node scripts/get-moodle-token.js
 *
 * Script ini akan:
 *   1. Tanya MOODLE_URL (base, mis. https://moodle.kamu.com)
 *   2. Tanya username & password admin Moodle (password tidak ditampilkan)
 *   3. Tanya service shortname (default: moodle_mobile_app)
 *   4. Tanya MOODLE_COURSE_ID, GROQ_API_KEY, kredensial DB
 *   5. Hit /login/token.php → ambil token
 *   6. Verifikasi token via core_webservice_get_site_info
 *   7. Tulis backend/.env (atau update kalau sudah ada)
 *
 * Catatan: password hanya dipakai sekali untuk request ke Moodle, tidak disimpan.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const ENV_PATH = path.join(__dirname, '..', '.env');

// ----- helper IO -----
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question, { secret = false, defaultValue = '' } = {}) {
    return new Promise((resolve) => {
        const prompt = defaultValue
            ? `${question} [${secret ? '***' : defaultValue}]: `
            : `${question}: `;

        if (!secret) {
            rl.question(prompt, (answer) => resolve(answer.trim() || defaultValue));
            return;
        }

        // Hidden input for password
        process.stdout.write(prompt);
        const stdin = process.openStdin();
        process.stdin.on('data', char => {
            char = char + '';
            switch (char) {
                case '\n': case '\r': case '\u0004':
                    process.stdin.pause();
                    break;
                default:
                    process.stdout.clearLine?.(0);
                    process.stdout.cursorTo?.(0);
                    process.stdout.write(prompt + Array(rl.line.length + 1).join('*'));
                    break;
            }
        });
        rl.question('', (answer) => {
            process.stdout.write('\n');
            resolve(answer.trim() || defaultValue);
        });
    });
}

// ----- HTTP request without external deps -----
function httpGet(urlStr) {
    return new Promise((resolve, reject) => {
        const u = new URL(urlStr);
        const lib = u.protocol === 'https:' ? https : http;
        const req = lib.get(urlStr, (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, json: JSON.parse(body), raw: body });
                } catch (e) {
                    resolve({ status: res.statusCode, json: null, raw: body });
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy(new Error('Request timeout (15s)'));
        });
    });
}

// ----- env file writer (preserve existing keys) -----
function readEnv() {
    if (!fs.existsSync(ENV_PATH)) return {};
    const content = fs.readFileSync(ENV_PATH, 'utf8');
    const out = {};
    for (const line of content.split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (m) out[m[1]] = m[2];
    }
    return out;
}

function writeEnv(values) {
    const order = [
        '# Server',
        'PORT', 'NODE_ENV', 'FRONTEND_URL',
        '# Database (MySQL)',
        'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME',
        '# Moodle Web Service',
        'MOODLE_URL', 'MOODLE_TOKEN', 'MOODLE_COURSE_ID',
        '# Groq AI (Kak Fikra)',
        'GROQ_API_KEY',
    ];

    const lines = [];
    for (const k of order) {
        if (k.startsWith('#')) {
            lines.push('');
            lines.push(k);
            continue;
        }
        if (values[k] !== undefined && values[k] !== '') {
            lines.push(`${k}=${values[k]}`);
        }
    }
    fs.writeFileSync(ENV_PATH, lines.join('\n').trim() + '\n', 'utf8');
}

// ----- main -----
(async () => {
    console.log('\n=== Fikra Middleware — Moodle Token Setup ===\n');

    const existing = readEnv();

    // 1. Moodle base URL
    let baseRaw = await ask(
        'Moodle base URL (mis. https://moodle.kamu.com)',
        { defaultValue: existing.MOODLE_URL ? existing.MOODLE_URL.replace(/\/webservice\/rest\/server\.php\/?$/, '') : '' }
    );
    if (!baseRaw) {
        console.error('Moodle URL wajib diisi');
        process.exit(1);
    }
    baseRaw = baseRaw.replace(/\/+$/, '');

    // 2. Credentials
    const username = await ask('Moodle admin username');
    const password = await ask('Moodle admin password', { secret: true });
    const service = await ask('Service shortname', { defaultValue: 'moodle_mobile_app' });

    // 3. Other env values
    const courseId = await ask('Moodle course ID', {
        defaultValue: existing.MOODLE_COURSE_ID || '2',
    });
    const groqKey = await ask('Groq API key (kosongkan kalau belum)', {
        defaultValue: existing.GROQ_API_KEY || '',
    });
    const dbHost = await ask('DB host', { defaultValue: existing.DB_HOST || 'localhost' });
    const dbPort = await ask('DB port', { defaultValue: existing.DB_PORT || '3306' });
    const dbUser = await ask('DB user', { defaultValue: existing.DB_USER || 'root' });
    const dbPass = await ask('DB password', { secret: true, defaultValue: existing.DB_PASS || '' });
    const dbName = await ask('DB name', { defaultValue: existing.DB_NAME || 'fikra_academy' });

    rl.close();

    // 4. Request token
    const tokenUrl = `${baseRaw}/login/token.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&service=${encodeURIComponent(service)}`;
    console.log('\n→ Meminta token dari Moodle...');

    let tokenRes;
    try {
        tokenRes = await httpGet(tokenUrl);
    } catch (err) {
        console.error('✗ Gagal terhubung ke Moodle:', err.message);
        process.exit(1);
    }

    if (!tokenRes.json) {
        console.error('✗ Response bukan JSON. Status:', tokenRes.status);
        console.error('Body:', tokenRes.raw.slice(0, 500));
        process.exit(1);
    }

    if (tokenRes.json.error || tokenRes.json.errorcode) {
        console.error('✗ Moodle menolak:', tokenRes.json.error || tokenRes.json.errorcode);
        if (tokenRes.json.errorcode === 'enablewsdescription') {
            console.error('  → Aktifkan dulu: Site admin → Advanced features → Enable web services');
        }
        if (tokenRes.json.errorcode === 'invalidlogin') {
            console.error('  → Username/password salah, atau service belum di-enable untuk user ini.');
        }
        process.exit(1);
    }

    const token = tokenRes.json.token;
    if (!token) {
        console.error('✗ Tidak dapat token. Response:', tokenRes.raw);
        process.exit(1);
    }
    console.log('✓ Token berhasil di-generate');

    // 5. Verify token
    const wsUrl = `${baseRaw}/webservice/rest/server.php`;
    const verifyUrl = `${wsUrl}?wstoken=${token}&wsfunction=core_webservice_get_site_info&moodlewsrestformat=json`;

    console.log('→ Verifikasi token...');
    const verifyRes = await httpGet(verifyUrl);
    if (verifyRes.json && verifyRes.json.sitename) {
        console.log(`✓ Token valid. Login sebagai: ${verifyRes.json.fullname} @ ${verifyRes.json.sitename}`);

        const requiredFns = [
            'core_webservice_get_site_info',
            'core_enrol_get_enrolled_users',
            'mod_quiz_get_quizzes_by_courses',
            'mod_quiz_get_user_attempts',
            'mod_quiz_get_attempt_review',
        ];
        const available = new Set((verifyRes.json.functions || []).map(f => f.name));
        const missing = requiredFns.filter(fn => !available.has(fn));
        if (missing.length) {
            console.warn('⚠ Fungsi WS yang belum tersedia di service ini:');
            missing.forEach(fn => console.warn('   -', fn));
            console.warn('  → Tambahkan via Site admin → Server → Web services → External services → Functions');
        } else {
            console.log('✓ Semua fungsi yang dibutuhkan tersedia');
        }
    } else {
        console.warn('⚠ Tidak bisa verifikasi token, tapi token tetap di-simpan.');
        console.warn('  Response:', verifyRes.raw.slice(0, 300));
    }

    // 6. Write .env
    const merged = {
        ...existing,
        PORT: existing.PORT || '3001',
        NODE_ENV: existing.NODE_ENV || 'development',
        FRONTEND_URL: existing.FRONTEND_URL || 'http://localhost:3000',
        DB_HOST: dbHost,
        DB_PORT: dbPort,
        DB_USER: dbUser,
        DB_PASS: dbPass,
        DB_NAME: dbName,
        MOODLE_URL: wsUrl,
        MOODLE_TOKEN: token,
        MOODLE_COURSE_ID: courseId,
        GROQ_API_KEY: groqKey,
    };
    writeEnv(merged);

    console.log(`\n✓ Disimpan ke: ${ENV_PATH}`);
    console.log('\nLangkah berikutnya:');
    console.log('  1. node scripts/apply-schema.js     # buat tabel');
    console.log('  2. node scripts/migrate.js          # apply migrations');
    console.log('  3. npm run dev                      # start backend\n');
})().catch((err) => {
    console.error('✗ Error:', err.message);
    process.exit(1);
});
