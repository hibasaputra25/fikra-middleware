/**
 * fix-html-entities.js
 *
 * Decode double-encoded HTML entities di kolom konten soal.
 * Contoh: &lt;p&gt; -> <p>
 *
 * Kolom yang diproses:
 *   - questions.content
 *   - questions.explanation
 *   - question_options.content
 *   - question_answers.answer_text
 *
 * Usage:
 *   node backend/scripts/fix-html-entities.js
 *   node backend/scripts/fix-html-entities.js --dry-run   (preview tanpa ubah DB)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const DB_CONFIG = {
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT || 3306,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
};

const DRY_RUN = process.argv.includes('--dry-run');

// =====================================================================
// Decode HTML entities (iteratif sampai tidak ada perubahan)
// =====================================================================

function decodeHtmlEntities(str) {
    if (!str) return str;
    let prev = null;
    let current = str;
    // Loop sampai tidak ada perubahan (handle multiple encoding levels)
    while (prev !== current) {
        prev = current;
        current = current
            .replace(/&lt;/g,   '<')
            .replace(/&gt;/g,   '>')
            .replace(/&amp;/g,  '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g,  "'")
            .replace(/&nbsp;/g, '\u00a0')
            .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
            .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    }
    return current;
}

function needsDecode(str) {
    if (!str) return false;
    return /&lt;|&gt;|&amp;|&quot;|&#39;|&#\d+;/.test(str);
}

// =====================================================================
// Process satu tabel
// =====================================================================

async function processTable(conn, table, idCol, columns) {
    let totalUpdated = 0;
    let totalSkipped = 0;

    for (const col of columns) {
        // Ambil semua rows yang perlu diupdate
        const [rows] = await conn.execute(
            `SELECT ${idCol}, ${col} FROM ${table} WHERE ${col} IS NOT NULL AND ${col} != ''`
        );

        let colUpdated = 0;
        for (const row of rows) {
            const original = row[col];
            if (!needsDecode(original)) {
                totalSkipped++;
                continue;
            }

            const decoded = decodeHtmlEntities(original);
            if (decoded === original) {
                totalSkipped++;
                continue;
            }

            if (!DRY_RUN) {
                await conn.execute(
                    `UPDATE ${table} SET ${col} = ? WHERE ${idCol} = ?`,
                    [decoded, row[idCol]]
                );
            } else {
                // Preview 1 sample per tabel per kolom
                if (colUpdated === 0) {
                    console.log(`\n  [DRY-RUN] ${table}.${col} sample (id=${row[idCol]})`);
                    console.log(`    BEFORE: ${original.slice(0, 100)}`);
                    console.log(`    AFTER:  ${decoded.slice(0, 100)}`);
                }
            }
            colUpdated++;
        }

        totalUpdated += colUpdated;
        console.log(`  ${table}.${col}: ${colUpdated} rows updated, ${rows.length - colUpdated} unchanged`);
    }

    return totalUpdated;
}

// =====================================================================
// MAIN
// =====================================================================

async function main() {
    if (DRY_RUN) {
        console.log('\ud83d\udd0d DRY RUN mode — tidak ada perubahan yang disimpan\n');
    } else {
        console.log('\u26a0\ufe0f  Script akan UPDATE konten soal di database.');
        console.log('   Tekan Ctrl+C dalam 5 detik untuk batal...');
        await new Promise(r => setTimeout(r, 5000));
    }

    const conn = await mysql.createConnection(DB_CONFIG);
    console.log('\ud83d\udd0c Connected ke database\n');

    let grand = 0;

    // questions
    console.log('\ud83d\udcdd Memproses tabel questions...');
    grand += await processTable(conn, 'questions', 'id', ['content', 'explanation']);

    // question_options
    console.log('\n\ud83d\udcdd Memproses tabel question_options...');
    grand += await processTable(conn, 'question_options', 'id', ['content']);

    // question_answers
    console.log('\n\ud83d\udcdd Memproses tabel question_answers...');
    grand += await processTable(conn, 'question_answers', 'id', ['answer_text']);

    await conn.end();

    if (DRY_RUN) {
        console.log(`\n\ud83d\udd0d DRY RUN selesai. ${grand} rows akan diupdate jika dijalankan tanpa --dry-run.`);
    } else {
        console.log(`\n\ud83c\udf89 Selesai! ${grand} rows berhasil diupdate.`);
    }
}

main().catch(err => {
    console.error('\n\u274c Fatal:', err.message);
    process.exit(1);
});
