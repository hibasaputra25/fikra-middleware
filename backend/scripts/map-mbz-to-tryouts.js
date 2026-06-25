/**
 * map-mbz-to-tryouts.js
 *
 * Mapping soal dari .mbz ke tryout_section_questions.
 * Script ini:
 * 1. Extract setiap .mbz, baca quiz.xml (slot order) dan questions.xml (bank_entry_id)
 * 2. Bangun map: slot -> questionbankentryid -> question content
 * 3. Cocokkan soal di DB Fikra berdasarkan konten (content matching)
 * 4. Insert ke tryout_sections + tryout_section_questions
 *
 * CATATAN: soal sudah ada di DB dari extract-mbz.js sebelumnya.
 * Script ini HANYA menambahkan relasi tryout <-> soal.
 *
 * Usage:
 *   node backend/scripts/map-mbz-to-tryouts.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');
const tar  = require('tar');
const os   = require('os');
const mysql = require('mysql2/promise');

const ROOT = path.join(__dirname, '..', '..');
const DB_CONFIG = {
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT || 3306,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
};

// =====================================================================
// HELPERS
// =====================================================================

function getTagValue(xml, tag) {
    const open  = `<${tag}`;
    const close = `</${tag}>`;
    const start = xml.indexOf(open);
    if (start === -1) return null;
    const contentStart = xml.indexOf('>', start) + 1;
    const end = xml.indexOf(close, contentStart);
    if (end === -1) return null;
    let val = xml.slice(contentStart, end);
    val = val.replace(/<\!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    return val.trim();
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

function getAttribute(block, attr) {
    const re = new RegExp(`${attr}="([^"]*?)"`);
    const m = block.match(re);
    return m ? m[1] : null;
}

function cleanHtml(html) {
    if (!html) return '';
    return html
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
        .replace(/\s{2,}/g, ' ').trim();
}

// Normalize teks soal untuk matching (hapus whitespace ekstra, lowercase)
function normalizeText(text) {
    return cleanHtml(text)
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9\(\)\[\]\{\}\.\,\+\-\=\/\\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200); // ambil 200 char pertama sebagai fingerprint
}

async function extractMbzFiles(mbzPath) {
    const buf  = fs.readFileSync(mbzPath);
    const data = zlib.gunzipSync(buf);
    const tmpDir = path.join(os.tmpdir(), 'mbz_map_' + Date.now());
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
// PARSE quiz.xml — ambil nama quiz + slot order
// =====================================================================

function parseQuizXml(xml) {
    const name        = getTagValue(xml, 'name') || 'Unknown Quiz';
    const timelimit   = parseInt(getTagValue(xml, 'timelimit') || '0') || null;
    const timeopen    = parseInt(getTagValue(xml, 'timeopen')  || '0') || 0;
    const timeclose   = parseInt(getTagValue(xml, 'timeclose') || '0') || 0;

    // Parse question_instance blocks — berisi slot + questionbankentryid
    const instances = getAllBlocks(xml, 'question_instance');
    const slots = [];
    for (const inst of instances) {
        const slot        = parseInt(getTagValue(inst, 'slot') || '0');
        const maxmark     = parseFloat(getTagValue(inst, 'maxmark') || '1') || 1;
        const bankEntryId = parseInt(getTagValue(inst, 'questionbankentryid') || '0');
        if (slot && bankEntryId) {
            slots.push({ slot, maxmark, bankEntryId });
        }
    }
    slots.sort((a, b) => a.slot - b.slot);

    return {
        name,
        timelimit_seconds: timelimit,
        duration_minutes: timelimit ? Math.round(timelimit / 60) : null,
        start_at: timeopen  > 0 ? new Date(timeopen  * 1000).toISOString().slice(0,19).replace('T',' ') : null,
        end_at:   timeclose > 0 ? new Date(timeclose * 1000).toISOString().slice(0,19).replace('T',' ') : null,
        slots
    };
}

// =====================================================================
// PARSE questions.xml — build map: bank_entry_id -> content fingerprint
// =====================================================================

function parseBankEntryMap(xml) {
    // bank_entry_id -> { content, name }
    const map = {};
    const qbeBlocks = getAllBlocks(xml, 'question_bank_entry');
    for (const qbe of qbeBlocks) {
        const entryId = getAttribute(qbe, 'id');
        if (!entryId) continue;

        // Ambil versi terbaru (versi terbesar)
        const versionBlocks = getAllBlocks(qbe, 'question_versions');
        let latestVersion = 0;
        let latestContent = '';
        let latestName    = '';

        for (const vb of versionBlocks) {
            const ver = parseInt(getTagValue(vb, 'version') || '0');
            const questionBlocks = getAllBlocks(vb, 'question');
            if (questionBlocks.length === 0) continue;
            const qb = questionBlocks[0];
            const content = getTagValue(qb, 'questiontext') || '';
            const name    = getTagValue(qb, 'name') || '';
            if (ver >= latestVersion) {
                latestVersion = ver;
                latestContent = content.trim();
                latestName    = name.trim();
            }
        }

        map[parseInt(entryId)] = {
            content:     latestContent,
            name:        latestName,
            fingerprint: normalizeText(latestContent || latestName)
        };
    }
    return map;
}

// =====================================================================
// MATCH soal dari DB berdasarkan fingerprint
// =====================================================================

async function buildDbFingerprintMap(conn) {
    // Ambil semua soal dari DB dengan content-nya
    const [rows] = await conn.execute(
        'SELECT id, content FROM questions WHERE is_active = 1'
    );
    const map = {}; // fingerprint -> question_id (ambil first match)
    for (const row of rows) {
        const fp = normalizeText(row.content || '');
        if (fp && !map[fp]) map[fp] = row.id;
    }
    return map;
}

// =====================================================================
// MAIN
// =====================================================================

async function main() {
    // Cari semua .mbz
    const mbzFiles = fs.readdirSync(ROOT)
        .filter(f => f.endsWith('.mbz'))
        .sort()
        .map(f => path.join(ROOT, f));

    if (mbzFiles.length === 0) {
        console.error('\u274c Tidak ada file .mbz ditemukan.');
        process.exit(1);
    }

    console.log(`\ud83c\udfaf Memproses ${mbzFiles.length} file .mbz`);
    console.log('\u26a0\ufe0f  Script akan membuat tryout sections dan mapping soal.');
    console.log('   Tekan Ctrl+C dalam 5 detik untuk batal...');
    await new Promise(r => setTimeout(r, 5000));

    const conn = await mysql.createConnection(DB_CONFIG);

    // Build fingerprint map dari DB sekali saja
    console.log('\n\ud83d\udd0d Membangun fingerprint map dari DB...');
    const dbFpMap = await buildDbFingerprintMap(conn);
    console.log(`   ${Object.keys(dbFpMap).length} soal terindeks`);

    // Cek tryout yang sudah ada agar tidak duplikat
    const [existingTryouts] = await conn.execute('SELECT id, name FROM tryouts');
    const tryoutByName = {};
    for (const t of existingTryouts) tryoutByName[t.name] = t.id;

    // Cek section yang sudah ada
    const [existingSections] = await conn.execute('SELECT id, tryout_id, name FROM tryout_sections');
    const sectionByTryout = {};
    for (const s of existingSections) sectionByTryout[s.tryout_id] = s.id;

    let totalMapped   = 0;
    let totalUnmapped = 0;

    for (const mbzPath of mbzFiles) {
        const filename = path.basename(mbzPath);
        console.log(`\n\ud83d\udce6 ${filename}`);

        let files;
        try {
            files = await extractMbzFiles(mbzPath);
        } catch (err) {
            console.error(`   \u274c Extract gagal: ${err.message}`);
            continue;
        }

        // Cari quiz.xml
        const quizXmlKey = Object.keys(files).find(f => f.match(/quiz\.xml$/));
        const qsXmlKey   = Object.keys(files).find(f => f === 'questions.xml');

        if (!quizXmlKey || !qsXmlKey) {
            console.log('   \u26a0\ufe0f  quiz.xml atau questions.xml tidak ditemukan, skip.');
            continue;
        }

        const quizInfo   = parseQuizXml(files[quizXmlKey]);
        const bankEntMap = parseBankEntryMap(files[qsXmlKey]);

        console.log(`   Quiz: "${quizInfo.name}" — ${quizInfo.slots.length} slot, durasi ${quizInfo.duration_minutes} menit`);
        console.log(`   Bank entries di questions.xml: ${Object.keys(bankEntMap).length}`);

        // Cari atau buat tryout
        let tryoutId = tryoutByName[quizInfo.name];
        if (tryoutId) {
            console.log(`   Tryout sudah ada: id=${tryoutId}`);
        } else {
            const [res] = await conn.execute(
                `INSERT INTO tryouts
                 (name, type, duration_minutes, start_at, end_at, status, shuffle_questions, shuffle_options, show_review, show_explanation)
                 VALUES (?, 'custom', ?, ?, ?, 'published', 0, 0, 1, 1)`,
                [quizInfo.name, quizInfo.duration_minutes, quizInfo.start_at, quizInfo.end_at]
            );
            tryoutId = res.insertId;
            tryoutByName[quizInfo.name] = tryoutId;
            console.log(`   Tryout baru dibuat: id=${tryoutId}`);
        }

        // Hapus section lama dari extract-mbz-to-sql jika ada (yang mungkin kosong)
        // Cek apakah section sudah punya soal
        let sectionId = sectionByTryout[tryoutId];
        if (sectionId) {
            const [[{ cnt }]] = await conn.execute(
                'SELECT COUNT(*) as cnt FROM tryout_section_questions WHERE section_id = ?',
                [sectionId]
            );
            if (parseInt(cnt) > 0) {
                console.log(`   Section sudah ada dengan ${cnt} soal, skip.`);
                continue;
            }
            // Section kosong, hapus dan buat ulang
            await conn.execute('DELETE FROM tryout_sections WHERE id = ?', [sectionId]);
        }

        // Buat section baru
        const [secRes] = await conn.execute(
            `INSERT INTO tryout_sections (tryout_id, name, sort_order, duration_minutes, total_questions)
             VALUES (?, 'Semua Soal', 1, ?, ?)`,
            [tryoutId, quizInfo.duration_minutes, quizInfo.slots.length]
        );
        sectionId = secRes.insertId;
        sectionByTryout[tryoutId] = sectionId;

        // Map slots ke question_id di DB
        let mapped   = 0;
        let unmapped = 0;
        const unmappedSamples = [];

        for (const slot of quizInfo.slots) {
            const bankEntry = bankEntMap[slot.bankEntryId];
            if (!bankEntry) {
                unmapped++;
                continue;
            }

            const fp = bankEntry.fingerprint;
            const fikraQId = dbFpMap[fp];

            if (!fikraQId) {
                unmapped++;
                if (unmappedSamples.length < 3) {
                    unmappedSamples.push(`"${bankEntry.name}" (fp: ${fp.slice(0,50)})`);
                }
                continue;
            }

            try {
                await conn.execute(
                    `INSERT IGNORE INTO tryout_section_questions
                     (section_id, question_id, sort_order, marks, penalty)
                     VALUES (?, ?, ?, ?, 0.00)`,
                    [sectionId, fikraQId, slot.slot, slot.maxmark]
                );
                mapped++;
            } catch (err) {
                unmapped++;
            }
        }

        // Update total_questions di section
        await conn.execute(
            'UPDATE tryout_sections SET total_questions = ? WHERE id = ?',
            [mapped, sectionId]
        );

        // Update total di tryout juga
        await conn.execute(
            'UPDATE tryouts SET description = ? WHERE id = ?',
            [`${quizInfo.slots.length} soal`, tryoutId]
        );

        totalMapped   += mapped;
        totalUnmapped += unmapped;

        console.log(`   \u2705 ${mapped} soal berhasil dimapping, ${unmapped} tidak ditemukan`);
        if (unmappedSamples.length > 0) {
            console.log(`   Contoh tidak ditemukan:`);
            unmappedSamples.forEach(s => console.log(`     - ${s}`));
        }
    }

    await conn.end();
    console.log(`\n\ud83c\udf89 Selesai! Total ${totalMapped} soal termapping, ${totalUnmapped} tidak ditemukan.`);
    if (totalUnmapped > 0) {
        console.log('   Soal tidak ditemukan kemungkinan ada di quiz lain atau belum diimport.');
    }
}

main().catch(err => {
    console.error('\n\u274c Fatal:', err.message);
    console.error(err.stack);
    process.exit(1);
});
