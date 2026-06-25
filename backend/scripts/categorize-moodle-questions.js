/**
 * categorize-moodle-questions.js
 *
 * Mapping kategori soal Moodle ke subtes Fikra Academy.
 * Baca questions.xml dari setiap .mbz, ambil questioncategoryid per soal,
 * lalu update questions.category_id di DB.
 *
 * Usage:
 *   node backend/scripts/categorize-moodle-questions.js
 *   node backend/scripts/categorize-moodle-questions.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs    = require('fs');
const path  = require('path');
const zlib  = require('zlib');
const tar   = require('tar');
const os    = require('os');
const mysql = require('mysql2/promise');

const ROOT    = path.join(__dirname, '..', '..');
const DRY_RUN = process.argv.includes('--dry-run');

const DB_CONFIG = {
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT || 3306,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
};

// =====================================================================
// Mapping nama kategori Moodle -> category_id Fikra
// Berdasarkan analisis: subtes ada di nama kategori
// =====================================================================

const CATEGORY_MAP = [
    // Penalaran Umum (PBM) - id=1
    { patterns: ['PENALARAN UMUM', 'penalaran umum', 'PBM'], fikra_id: 1 },

    // Pengetahuan dan Pemahaman Umum (PPU) - id=2
    { patterns: ['PENGETAHUAN DAN PEMAHAMAN UMUM', 'pengetahuan dan pemahaman', 'PPU'], fikra_id: 2 },

    // Pemahaman Bacaan dan Menulis (PK) - id=3
    { patterns: [
        'KEMAMPUAN MEMAHAMI BACAAN DAN MENULIS',
        'PEMAHAMAN BACAAN DAN MENULIS',
        'MEMBACA DAN MENULIS',
        'PK'
    ], fikra_id: 3 },

    // Pengetahuan Kuantitatif (PM) - id=4
    { patterns: [
        'PENALARAN KUANTITATIF',
        'PENGETAHUAN KUANTITATIF',
        'Fikra Academy mtk',
        'mtk okt',
        'PM'
    ], fikra_id: 4 },

    // Penalaran Matematika (PU) - id=5
    { patterns: [
        'PENALARAN MATEMATIKA',
        'Fikra Academy PK',  // Fikra Academy PK = Penalaran Kuantitatif di konteks Moodle mereka
        'PU'
    ], fikra_id: 5 },

    // Pengetahuan Kuantitatif (PM) juga match 'Fikra Academy PK' lebih dulu di CATEGORY_MAP
    // Karena urutan array, PU akan match duluan untuk 'Fikra Academy PK'

    // Literasi Bahasa Indonesia (LBI) - id=6
    { patterns: [
        'LITERASI BAHASA INDONESIA',
        'Fikra Academy Indo',
        'indo okt',
        'LBI'
    ], fikra_id: 6 },

    // Literasi Bahasa Inggris (LBE) - id=7
    { patterns: [
        'LITERASI BAHASA INGGRIS',
        'Fikra Academy ing',
        'ing okt',
        'BAHASA INGGRIS',
        'LBE'
    ], fikra_id: 7 },
];

function mapCategoryToFikra(categoryName) {
    if (!categoryName) return null;
    const upper = categoryName.toUpperCase();
    for (const mapping of CATEGORY_MAP) {
        for (const pattern of mapping.patterns) {
            if (upper.includes(pattern.toUpperCase())) {
                return mapping.fikra_id;
            }
        }
    }
    return null;
}

// =====================================================================
// XML HELPERS
// =====================================================================

function getTagValue(xml, tag) {
    const open  = `<${tag}`;
    const close = `</${tag}>`;
    const start = xml.indexOf(open);
    if (start === -1) return null;
    const contentStart = xml.indexOf('>', start) + 1;
    const end = xml.indexOf(close, contentStart);
    if (end === -1) return null;
    return xml.slice(contentStart, end)
        .replace(/<\!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .trim();
}

function getAttribute(block, attr) {
    const re = new RegExp(`${attr}="([^"]*?)"`);
    const m = block.match(re);
    return m ? m[1] : null;
}

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

// =====================================================================
// EXTRACT mbz
// =====================================================================

function extractMbzSync(mbzPath) {
    const buf  = fs.readFileSync(mbzPath);
    const data = zlib.gunzipSync(buf);
    const tmpDir = path.join(os.tmpdir(), 'mbz_cat_' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmpTar = path.join(tmpDir, 'a.tar');
    fs.writeFileSync(tmpTar, data);
    tar.x({ file: tmpTar, cwd: tmpDir, sync: true });

    const files = {};
    function readDir(dir) {
        for (const entry of fs.readdirSync(dir)) {
            const full = path.join(dir, entry);
            if (fs.statSync(full).isDirectory()) readDir(full);
            else if (entry.endsWith('.xml')) {
                const rel = path.relative(tmpDir, full).replace(/\\/g, '/');
                files[rel] = fs.readFileSync(full, 'utf8');
            }
        }
    }
    readDir(tmpDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return files;
}

// =====================================================================
// PARSE: ambil category_id per soal dari questions.xml
// =====================================================================

function parseCategoryMap(xml) {
    // Build: category_id -> category_name
    const catNameMap = {};
    const catBlocks = getAllBlocks(xml, 'question_category');
    for (const block of catBlocks) {
        const id   = getAttribute(block, 'id');
        const name = getTagValue(block, 'name') || getTagValue(block, 'idnumber') || '';
        if (id) catNameMap[parseInt(id)] = name;
    }
    return catNameMap;
}

function parseQuestionCategories(xml) {
    // Return: array of { content, categoryId }
    const result = [];
    const qbeBlocks = getAllBlocks(xml, 'question_bank_entry');

    for (const qbe of qbeBlocks) {
        const categoryId = parseInt(getTagValue(qbe, 'questioncategoryid') || '0');

        // Ambil konten soal dari versi terbaru
        const versionBlocks = getAllBlocks(qbe, 'question_versions');
        let latestVer = -1;
        let latestContent = '';
        let latestName = '';
        let latestQtype = '';

        for (const vb of versionBlocks) {
            const ver = parseInt(getTagValue(vb, 'version') || '0');
            const qBlocks = getAllBlocks(vb, 'question');
            if (qBlocks.length === 0) continue;
            const qb = qBlocks[0];
            if (ver >= latestVer) {
                latestVer = ver;
                latestContent = (getTagValue(qb, 'questiontext') || '').trim();
                latestName    = (getTagValue(qb, 'name') || '').trim();
                latestQtype   = (getTagValue(qb, 'qtype') || '').trim();
            }
        }

        if (latestQtype === 'description' || latestQtype === '') continue;
        if (!latestContent && !latestName) continue;

        result.push({
            content:    latestContent || latestName,
            name:       latestName,
            categoryId,
            qtype:      latestQtype
        });
    }

    return result;
}

// =====================================================================
// FINGERPRINT untuk matching ke DB
// =====================================================================

function decodeEntities(str) {
    if (!str) return str;
    let prev = null, cur = str;
    while (prev !== cur) {
        prev = cur;
        cur = cur
            .replace(/&lt;/g,'<').replace(/&gt;/g,'>')
            .replace(/&amp;/g,'&').replace(/&quot;/g,'"')
            .replace(/&#39;/g,"'").replace(/&nbsp;/g,' ')
            .replace(/&#(\d+);/g,(_,c)=>String.fromCharCode(parseInt(c)))
            .replace(/&#x([0-9a-fA-F]+);/g,(_,h)=>String.fromCharCode(parseInt(h,16)));
    }
    return cur;
}

function fingerprint(text) {
    if (!text) return '';
    return decodeEntities(text)
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\\\(/g, ' ').replace(/\\\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .slice(0, 150);
}

// =====================================================================
// MAIN
// =====================================================================

async function main() {
    if (DRY_RUN) {
        console.log('\ud83d\udd0d DRY RUN — tidak ada perubahan yang disimpan\n');
    } else {
        console.log('\u26a0\ufe0f  Script akan UPDATE category_id di tabel questions.');
        console.log('   Tekan Ctrl+C dalam 5 detik untuk batal...');
        await new Promise(r => setTimeout(r, 5000));
    }

    // Cari semua .mbz
    const mbzFiles = fs.readdirSync(ROOT)
        .filter(f => f.endsWith('.mbz'))
        .sort()
        .map(f => path.join(ROOT, f));

    console.log(`\n\ud83d\udce6 ${mbzFiles.length} file .mbz ditemukan`);

    const conn = await mysql.createConnection(DB_CONFIG);

    // Ambil semua soal dari DB untuk fingerprint matching
    console.log('\n\ud83d\udd0d Membangun fingerprint map dari DB...');
    const [dbQuestions] = await conn.execute(
        'SELECT id, content, category_id FROM questions WHERE is_active = 1'
    );
    const fpMap = {}; // fingerprint -> { id, category_id }
    for (const q of dbQuestions) {
        const fp = fingerprint(q.content || '');
        if (fp && !fpMap[fp]) fpMap[fp] = { id: q.id, category_id: q.category_id };
    }
    console.log(`   ${Object.keys(fpMap).length} soal terindeks`);

    let totalUpdated  = 0;
    let totalUnmapped = 0;
    let totalNoMatch  = 0;
    const unmappedCategories = new Set();

    for (const mbzPath of mbzFiles) {
        const filename = path.basename(mbzPath);
        console.log(`\n\ud83d\udce6 Memproses: ${filename}`);

        let files;
        try {
            files = extractMbzSync(mbzPath);
        } catch (err) {
            console.error(`   \u274c Extract gagal: ${err.message}`);
            continue;
        }

        const qsXmlKey = Object.keys(files).find(f => f === 'questions.xml');
        if (!qsXmlKey) { console.log('   \u26a0\ufe0f  questions.xml tidak ditemukan'); continue; }

        const xml = files[qsXmlKey];

        // Build category name map dari XML ini
        const catNameMap = parseCategoryMap(xml);
        console.log(`   Kategori ditemukan: ${Object.keys(catNameMap).length}`);
        for (const [id, name] of Object.entries(catNameMap)) {
            const fikraId = mapCategoryToFikra(name);
            console.log(`     [${id}] "${name}" -> Fikra cat_id: ${fikraId || 'TIDAK DIKENALI'}`);
        }

        // Parse soal + category
        const questions = parseQuestionCategories(xml);
        console.log(`   ${questions.length} soal diparsed`);

        let fileUpdated = 0;
        let fileUnmapped = 0;
        let fileNoMatch = 0;

        for (const q of questions) {
            // Resolve category name
            const catName   = catNameMap[q.categoryId] || '';
            const fikraCatId = mapCategoryToFikra(catName);

            if (!fikraCatId) {
                fileUnmapped++;
                if (catName) unmappedCategories.add(catName);
                continue;
            }

            // Match soal di DB via fingerprint
            const fp = fingerprint(q.content);
            const dbQ = fpMap[fp];

            if (!dbQ) {
                fileNoMatch++;
                continue;
            }

            // Selalu update — re-kategorisasi ulang berdasarkan mapping terbaru

            if (!DRY_RUN) {
                await conn.execute(
                    'UPDATE questions SET category_id = ? WHERE id = ?',
                    [fikraCatId, dbQ.id]
                );
            }
            // Update local map juga untuk hindari double update
            dbQ.category_id = fikraCatId;
            fileUpdated++;
        }

        console.log(`   \u2705 ${fileUpdated} soal dikategorikan, ${fileUnmapped} tidak dikenali kategorinya, ${fileNoMatch} tidak cocok di DB`);
        totalUpdated  += fileUpdated;
        totalUnmapped += fileUnmapped;
        totalNoMatch  += fileNoMatch;
    }

    // Summary
    console.log('\n\u2500'.repeat(50));
    console.log(`\u2705 Total soal dikategorikan : ${totalUpdated}`);
    console.log(`\u26a0\ufe0f  Kategori tidak dikenali  : ${totalUnmapped}`);
    console.log(`\u274c  Tidak cocok di DB         : ${totalNoMatch}`);

    if (unmappedCategories.size > 0) {
        console.log('\nKategori Moodle yang belum dipetakan:');
        for (const c of unmappedCategories) console.log(`  - "${c}"`);
    }

    // Cek hasil akhir
    const [[{ uncategorized }]] = await conn.execute(
        'SELECT COUNT(*) as uncategorized FROM questions WHERE category_id IS NULL AND is_active = 1'
    );
    console.log(`\nSoal masih tanpa kategori: ${uncategorized}`);

    await conn.end();

    if (DRY_RUN) {
        console.log('\n\ud83d\udd0d DRY RUN selesai. Jalankan tanpa --dry-run untuk apply.');
    } else {
        console.log('\n\ud83c\udf89 Selesai!');
    }
}

main().catch(err => {
    console.error('\n\u274c Fatal:', err.message);
    console.error(err.stack);
    process.exit(1);
});
