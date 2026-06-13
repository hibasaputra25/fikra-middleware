// Run all migrations in /migrations folder yang belum diapply.
// Pisahkan SQL ke statement-statement individual berdasarkan ;
// Skip error idempoten (Duplicate column / Table already exists)
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const DB_CONFIG = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    multipleStatements: true
};

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

// Idempotent error codes — aman untuk diabaikan saat migration ulang
const IDEMPOTENT_CODES = new Set([
    'ER_DUP_FIELDNAME',          // 1060 - duplicate column name
    'ER_TABLE_EXISTS_ERROR',     // 1050 - table already exists
    'ER_DUP_KEYNAME',            // 1061 - duplicate key
    'ER_FK_DUP_NAME',            // 1826 - duplicate FK
    'ER_DUP_INDEX'               // 1831 - duplicate index
]);

async function ensureMigrationsTable(conn) {
    await conn.query(`
        CREATE TABLE IF NOT EXISTS migrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    `);
}

async function listApplied(conn) {
    const [rows] = await conn.query('SELECT filename FROM migrations ORDER BY id');
    return new Set(rows.map(r => r.filename));
}

// Split SQL by ; respecting strings/comments
function splitStatements(sql) {
    const statements = [];
    let current = '';
    let inString = null;       // ', " or `
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < sql.length; i++) {
        const ch = sql[i];
        const next = sql[i + 1];

        if (inLineComment) {
            if (ch === '\n') inLineComment = false;
            current += ch;
            continue;
        }
        if (inBlockComment) {
            if (ch === '*' && next === '/') {
                inBlockComment = false;
                current += ch + next;
                i++;
                continue;
            }
            current += ch;
            continue;
        }
        if (inString) {
            if (ch === '\\' && next) {
                current += ch + next;
                i++;
                continue;
            }
            if (ch === inString) inString = null;
            current += ch;
            continue;
        }

        // not in string/comment
        if (ch === '-' && next === '-') {
            inLineComment = true;
            current += ch;
            continue;
        }
        if (ch === '/' && next === '*') {
            inBlockComment = true;
            current += ch + next;
            i++;
            continue;
        }
        if (ch === "'" || ch === '"' || ch === '`') {
            inString = ch;
            current += ch;
            continue;
        }
        if (ch === ';') {
            const trimmed = current.trim();
            if (trimmed) statements.push(trimmed);
            current = '';
            continue;
        }
        current += ch;
    }
    const tail = current.trim();
    if (tail) statements.push(tail);
    return statements;
}

async function applyFile(conn, filename) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
    const statements = splitStatements(sql);

    let executed = 0;
    let skipped = 0;

    for (const stmt of statements) {
        try {
            await conn.query(stmt);
            executed++;
        } catch (err) {
            if (IDEMPOTENT_CODES.has(err.code)) {
                skipped++;
                continue;
            }
            console.error(`\n❌ Failed at statement:\n${stmt.slice(0, 200)}${stmt.length > 200 ? '...' : ''}`);
            throw err;
        }
    }

    return { executed, skipped, total: statements.length };
}

async function run() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        console.log('No migrations folder found.');
        return;
    }

    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();

    if (files.length === 0) {
        console.log('No migration files.');
        return;
    }

    console.log(`Connecting to ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}...`);
    const conn = await mysql.createConnection(DB_CONFIG);

    try {
        await ensureMigrationsTable(conn);
        const applied = await listApplied(conn);

        let appliedCount = 0;
        for (const filename of files) {
            if (applied.has(filename)) {
                console.log(`✔  ${filename} (already applied)`);
                continue;
            }

            console.log(`▶  ${filename} ...`);
            const stats = await applyFile(conn, filename);
            await conn.execute('INSERT INTO migrations (filename) VALUES (?)', [filename]);
            console.log(`✅ ${filename} (${stats.executed} executed, ${stats.skipped} skipped, ${stats.total} total)`);
            appliedCount++;
        }

        if (appliedCount === 0) {
            console.log('\nNothing to migrate. All up to date.');
        } else {
            console.log(`\n✨ ${appliedCount} migration(s) applied.`);
        }
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exitCode = 1;
    } finally {
        await conn.end();
    }
}

run();
