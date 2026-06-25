/**
 * extract-mbz.js
 * 
 * Ekstrak dan parse file .mbz Moodle (tar.gz berisi XML)
 * kemudian migrasi soal ke database Fikra Academy.
 *
 * Usage:
 *   node backend/scripts/extract-mbz.js [path-ke-file.mbz]
 *
 * Jika path tidak diberikan, akan memproses semua .mbz di root project.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs    = require('fs');
const path  = require('path');
const zlib  = require('zlib');
const tar   = require('tar');
const mysql = require('mysql2/promise');

const ROOT    = path.join(__dirname, '..', '..');
const DB_CONFIG = {
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT || 3306,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
};

// =====================================================================
// 1. EXTRACT mbz ke memory
// =====================================================================

async function extractMbz(mbzPath) {
    const buf = fs.readFileSync(mbzPath);
    const decompressed = await new Promise((resolve, reject) => {
        zlib.gunzip(buf, (err, data) => err ? reject(err) : resolve(data));
    });

    const files = {}; // filename -> content string

    await new Promise((resolve, reject) => {
        const tmpDir = path.join(require('os').tmpdir(), 'fikra_mbz_' + Date.now());
        fs.mkdirSync(tmpDir, { recursive: true });

        // Tulis decompressed ke tmp file lalu extract dengan tar
        const tmpTar = path.join(tmpDir, 'archive.tar');
        fs.writeFileSync(tmpTar, decompressed);

        tar.x({ file: tmpTar, cwd: tmpDir, sync: true });

        // Baca semua XML files
        function readDir(dir) {
            for (const entry of fs.readdirSync(dir)) {
                const full = path.join(dir, entry);
                const stat = fs.statSync(full);
                if (stat.isDirectory()) {
                    readDir(full);
                } else if (entry.endsWith('.xml')) {
                    const rel = path.relative(tmpDir, full).replace(/\\/g, '/');
                    files[rel] = fs.readFileSync(full, 'utf8');
                }
            }
        }
        readDir(tmpDir);

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true, force: true });
        resolve();
    });

    return files;
}

// =====================================================================
// 2. SIMPLE XML PARSER (tanpa library)
// =====================================================================

/**
 * Ekstrak nilai tag tertentu dari XML string
 * Mendukung nested dan CDATA
 */
function getTagValue(xml, tag) {
    const open  = `<${tag}`;
    const close = `</${tag}>`;
    const start = xml.indexOf(open);
    if (start === -1) return null;
    const contentStart = xml.indexOf('>', start) + 1;
    const end = xml.indexOf(close, contentStart);
    if (end === -1) return null;
    let val = xml.slice(contentStart, end);
    // Strip CDATA
    val = val.replace(/<\!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    return val.trim();
}

/**
 * Ekstrak semua blok <tag>...</tag> dari XML
 */
function getAllBlocks(xml, tag) {
    const open  = `<${tag}`;
    const close = `</${tag}>`;
    const blocks = [];
    let pos = 0;
    while (true) {
        const start = xml.indexOf(open, pos);
        if (start === -1) break;
        const end = xml.indexOf(close, start);
        if (end === -1) break;
        blocks.push(xml.slice(start, end + close.length));
        pos = end + close.length;
    }
    return blocks;
}

/**
 * Ambil nilai attribute dari tag
 */
function getAttribute(tag, attr) {
    const re = new RegExp(`${attr}="([^"]*)"`);
    const m = tag.match(re);
    return m ? m[1] : null;
}

/**
 * Strip HTML tags, decode entities
 */
function cleanHtml(html) {
    if (!html) return '';
    return html
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s{2,}/g, ' ')
        .trim();
}

// =====================================================================
// 3. PARSE questions.xml dari Moodle backup
// =====================================================================

function mapQtype(moodleType) {
    switch (moodleType) {
        case 'multichoice':    return 'mcq_single';
        case 'multichoiceset': return 'mcq_multi';
        case 'truefalse':      return 'true_false';
        case 'shortanswer':    return 'short_answer';
        case 'numerical':      return 'numeric';
        case 'essay':          return 'essay';
        default:               return null;
    }
}

function parseQuestionsXml(xml) {
    const questions = [];
    const qBlocks = getAllBlocks(xml, 'question_bank_entry');

    for (const qbe of qBlocks) {
        // Ambil versi terbaru
        const versionBlocks = getAllBlocks(qbe, 'question_version');
        if (versionBlocks.length === 0) continue;
        // Ambil versi terakhir
        const latestVersion = versionBlocks[versionBlocks.length - 1];
        const qBlk = getTagValue(latestVersion, 'question') || latestVersion;

        const qtype = getTagValue(qbe, 'qtype') || getTagValue(latestVersion, 'qtype');
        const type  = mapQtype(qtype);
        if (!type) continue;

        const name        = cleanHtml(getTagValue(qbe, 'name') || '');
        const contentRaw  = getTagValue(qbe, 'questiontext') || '';
        const content     = contentRaw.trim(); // jaga HTML untuk LaTeX
        const defaultMark = parseFloat(getTagValue(qbe, 'defaultmark') || '1') || 1;
        const penalty     = parseFloat(getTagValue(qbe, 'penalty') || '0') || 0;
        const generalFeedback = getTagValue(qbe, 'generalfeedback') || '';

        // Parse answers/options
        const answerBlocks = getAllBlocks(qbe, 'answer');
        const answers = answerBlocks.map(ab => ({
            text:     (getTagValue(ab, 'answertext') || '').trim(),
            fraction: parseFloat(getTagValue(ab, 'fraction') || '0') || 0,
            feedback: cleanHtml(getTagValue(ab, 'feedback') || '')
        })).filter(a => a.text);

        // Untuk numerical — ambil dari <numerical> block
        const numericBlocks = getAllBlocks(qbe, 'numerical');
        const numerics = numericBlocks.map(nb => ({
            answer:    parseFloat(getTagValue(nb, 'answer') || '0'),
            tolerance: parseFloat(getTagValue(nb, 'tolerance') || '0')
        }));

        questions.push({
            name,
            content: content || name,
            type,
            default_marks: defaultMark,
            penalty: penalty * defaultMark,
            explanation: cleanHtml(generalFeedback),
            answers,
            numerics
        });
    }

    return questions;
}

/**
 * Fallback: parse format GIFT atau XML question lama
 */
function parseQuestionsXmlLegacy(xml) {
    const questions = [];
    // Coba format <question type="...">
    const qBlocks = getAllBlocks(xml, 'question');
    for (const block of qBlocks) {
        const typeAttr = block.match(/^<question[^>]+type="([^"]+)"/);
        if (!typeAttr) continue;
        const type = mapQtype(typeAttr[1]);
        if (!type) continue;

        const name        = cleanHtml(getTagValue(block, 'name') || '');
        const contentRaw  = getTagValue(block, 'questiontext') || getTagValue(block, 'text') || '';
        const content     = contentRaw.trim();
        const defaultMark = parseFloat(getTagValue(block, 'defaultmark') || '1') || 1;
        const penalty     = parseFloat(getTagValue(block, 'penalty') || '0') || 0;
        const explanation = cleanHtml(getTagValue(block, 'generalfeedback') || '');

        const answerBlocks = getAllBlocks(block, 'answer');
        const answers = answerBlocks.map(ab => {
            const fracAttr = ab.match(/^<answer[^>]+fraction="([^"]+)"/);
            const fraction = fracAttr ? parseFloat(fracAttr[1]) / 100 : 0;
            const text = cleanHtml(getTagValue(ab, 'text') || getTagValue(ab, 'answertext') || '');
            return { text, fraction };
        }).filter(a => a.text);

        const numerics = [];
        if (type === 'numeric') {
            for (const a of answerBlocks) {
                const toleranceBlock = getTagValue(a, 'tolerance');
                const answerText = cleanHtml(getTagValue(a, 'text') || '');
                const num = parseFloat(answerText);
                if (!isNaN(num)) {
                    numerics.push({ answer: num, tolerance: parseFloat(toleranceBlock || '0') });
                }
            }
        }

        questions.push({
            name,
            content: content || name,
            type,
            default_marks: defaultMark,
            penalty: penalty * defaultMark,
            explanation,
            answers,
            numerics
        });
    }
    return questions;
}

// =====================================================================
// 4. INSERT ke Fikra DB
// =====================================================================

async function insertQuestions(conn, questions, source) {
    let inserted = 0;
    let skipped  = 0;

    for (const q of questions) {
        try {
            const [result] = await conn.execute(
                `INSERT INTO questions
                 (type, content, explanation, difficulty, default_marks, penalty, is_active)
                 VALUES (?, ?, ?, 'medium', ?, ?, 1)`,
                [q.type, q.content, q.explanation || null, q.default_marks, q.penalty]
            );
            const qId = result.insertId;

            if (['mcq_single', 'mcq_multi', 'true_false'].includes(q.type)) {
                for (let i = 0; i < q.answers.length; i++) {
                    const a = q.answers[i];
                    const isCorrect = a.fraction >= 1.0 ? 1 : 0;
                    await conn.execute(
                        `INSERT INTO question_options (question_id, content, is_correct, sort_order)
                         VALUES (?, ?, ?, ?)`,
                        [qId, a.text, isCorrect, i + 1]
                    );
                }
            } else if (q.type === 'short_answer') {
                for (const a of q.answers) {
                    if (!a.text) continue;
                    await conn.execute(
                        `INSERT INTO question_answers (question_id, answer_text, match_type)
                         VALUES (?, ?, 'case_insensitive')`,
                        [qId, a.text]
                    );
                }
            } else if (q.type === 'numeric') {
                const numList = q.numerics.length > 0 ? q.numerics :
                    q.answers.map(a => ({ answer: parseFloat(a.text), tolerance: 0 })).filter(n => !isNaN(n.answer));
                for (const n of numList) {
                    await conn.execute(
                        `INSERT INTO question_answers (question_id, numeric_value, numeric_tolerance, match_type)
                         VALUES (?, ?, ?, 'exact')`,
                        [qId, n.answer, n.tolerance]
                    );
                }
            }

            inserted++;
        } catch (err) {
            skipped++;
        }
    }
    console.log(`   [${source}] ${inserted} soal berhasil, ${skipped} dilewati`);
    return inserted;
}

// =====================================================================
// 5. MAIN
// =====================================================================

async function processMbz(mbzPath, conn) {
    const filename = path.basename(mbzPath);
    console.log(`\n📦 Memproses: ${filename}`);

    let files;
    try {
        files = await extractMbz(mbzPath);
    } catch (err) {
        console.error(`   ❌ Gagal extract: ${err.message}`);
        return 0;
    }

    console.log(`   File dalam archive: ${Object.keys(files).join(', ')}`);

    // Cari file questions XML
    const questionFiles = Object.keys(files).filter(f =>
        f.includes('question') || f === 'questions.xml' || f.includes('/questions/')
    );
    console.log(`   Question files: ${questionFiles.join(', ') || 'tidak ditemukan'}`);

    let allQuestions = [];

    for (const qFile of questionFiles) {
        const xml = files[qFile];
        let qs = parseQuestionsXml(xml);
        if (qs.length === 0) qs = parseQuestionsXmlLegacy(xml);
        console.log(`   ${qFile}: ${qs.length} soal parsed`);
        allQuestions.push(...qs);
    }

    // Jika tidak ada di question files, coba semua XML
    if (allQuestions.length === 0) {
        for (const [fname, xml] of Object.entries(files)) {
            let qs = parseQuestionsXml(xml);
            if (qs.length === 0) qs = parseQuestionsXmlLegacy(xml);
            if (qs.length > 0) {
                console.log(`   ${fname}: ${qs.length} soal parsed`);
                allQuestions.push(...qs);
            }
        }
    }

    if (allQuestions.length === 0) {
        console.log('   ⚠️  Tidak ada soal ditemukan di file ini.');
        // Dump first 500 chars of each XML for debugging
        for (const [fname, xml] of Object.entries(files)) {
            console.log(`   [${fname}] preview: ${xml.slice(0, 300).replace(/\n/g, ' ')}`);
        }
        return 0;
    }

    console.log(`   Total: ${allQuestions.length} soal ditemukan`);
    const breakdown = {};
    for (const q of allQuestions) breakdown[q.type] = (breakdown[q.type] || 0) + 1;
    for (const [t, c] of Object.entries(breakdown)) console.log(`     ${t}: ${c}`);

    return await insertQuestions(conn, allQuestions, filename);
}

async function main() {
    // Cari semua file .mbz
    const mbzArg = process.argv[2];
    let mbzFiles;

    if (mbzArg) {
        mbzFiles = [path.resolve(mbzArg)];
    } else {
        mbzFiles = fs.readdirSync(ROOT)
            .filter(f => f.endsWith('.mbz'))
            .map(f => path.join(ROOT, f));
    }

    if (mbzFiles.length === 0) {
        console.error('❌ Tidak ada file .mbz ditemukan.');
        process.exit(1);
    }

    console.log(`🎯 Akan memproses ${mbzFiles.length} file .mbz:`);
    mbzFiles.forEach(f => console.log(`   - ${path.basename(f)}`));

    console.log('\n⚠️  Script akan INSERT soal ke database Fikra.');
    console.log('   Tekan Ctrl+C dalam 5 detik untuk batal...');
    await new Promise(r => setTimeout(r, 5000));

    console.log('\n🔌 Connecting ke database...');
    const conn = await mysql.createConnection(DB_CONFIG);

    let totalInserted = 0;
    for (const mbzPath of mbzFiles) {
        totalInserted += await processMbz(mbzPath, conn);
    }

    await conn.end();
    console.log(`\n🎉 Selesai! Total ${totalInserted} soal berhasil dimigrasi dari .mbz`);
}

main().catch(err => {
    console.error('\n❌ Fatal:', err.message);
    console.error(err.stack);
    process.exit(1);
});
