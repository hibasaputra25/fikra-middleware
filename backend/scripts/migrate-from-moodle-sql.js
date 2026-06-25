/**
 * migrate-from-moodle-sql.js
 * 
 * Migrasi soal dari MariaDB dump Moodle ke schema Fikra Academy.
 * Parse langsung dari file SQL — tidak butuh koneksi ke server Moodle.
 *
 * Usage:
 *   node backend/scripts/migrate-from-moodle-sql.js
 *
 * Env yang dibutuhkan: DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs   = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const SQL_FILE = path.join(__dirname, '..', '..', 'moodle_backup_21_04_2026.sql');

const DB_CONFIG = {
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT || 3306,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
};

// =====================================================================
// 1. PARSER: Extract INSERT rows dari SQL dump
// =====================================================================

/**
 * Ambil semua baris VALUES dari satu INSERT INTO `table` VALUES (...),(...);
 * Return: array of raw value strings (belum diparsed)
 */
function extractInsertBlock(sql, tableName) {
    const marker = `INSERT INTO \`${tableName}\` VALUES `;
    const results = [];
    let pos = 0;
    while (true) {
        const idx = sql.indexOf(marker, pos);
        if (idx === -1) break;
        const end = sql.indexOf(';', idx);
        const block = sql.slice(idx + marker.length, end);
        results.push(block);
        pos = end + 1;
    }
    return results;
}

/**
 * Parse satu blok VALUES (a,b,c),(d,e,f) ke array of arrays.
 * Handle string literals dengan escape, NULL, numbers.
 */
function parseValuesBlock(block) {
    const rows = [];
    let i = 0;
    const len = block.length;

    while (i < len) {
        // skip whitespace/comma antara rows
        while (i < len && (block[i] === ',' || block[i] === '\n' || block[i] === '\r' || block[i] === ' ')) i++;
        if (i >= len) break;
        if (block[i] !== '(') { i++; continue; }
        i++; // skip '('

        const row = [];
        while (i < len && block[i] !== ')') {
            // skip whitespace
            while (i < len && block[i] === ' ') i++;

            if (block[i] === "'") {
                // string literal
                i++;
                let val = '';
                while (i < len) {
                    if (block[i] === '\\') {
                        const next = block[i + 1];
                        if (next === "'") { val += "'"; i += 2; }
                        else if (next === '\\') { val += '\\'; i += 2; }
                        else if (next === 'n') { val += '\n'; i += 2; }
                        else if (next === 'r') { val += '\r'; i += 2; }
                        else if (next === 't') { val += '\t'; i += 2; }
                        else { val += block[i]; i++; }
                    } else if (block[i] === "'" && block[i + 1] === "'") {
                        // escaped quote
                        val += "'";
                        i += 2;
                    } else if (block[i] === "'") {
                        i++; break;
                    } else {
                        val += block[i++];
                    }
                }
                row.push(val);
            } else {
                // number / NULL / keyword
                let val = '';
                while (i < len && block[i] !== ',' && block[i] !== ')') {
                    val += block[i++];
                }
                if (val.trim() === 'NULL') row.push(null);
                else row.push(val.trim());
            }

            // skip comma between values
            while (i < len && block[i] === ' ') i++;
            if (i < len && block[i] === ',') i++;
        }
        if (block[i] === ')') i++;
        if (row.length > 0) rows.push(row);
    }
    return rows;
}

function parseTable(sql, tableName) {
    const blocks = extractInsertBlock(sql, tableName);
    const rows = [];
    for (const block of blocks) rows.push(...parseValuesBlock(block));
    return rows;
}

// =====================================================================
// 2. TRANSFORM
// =====================================================================

/**
 * Map tipe soal Moodle ke tipe Fikra
 */
function mapQuestionType(moodleType) {
    switch (moodleType) {
        case 'multichoice':    return 'mcq_single';
        case 'multichoiceset': return 'mcq_multi';
        case 'truefalse':      return 'true_false';
        case 'shortanswer':    return 'short_answer';
        case 'numerical':      return 'numeric';
        case 'essay':          return 'essay';
        default:               return null; // skip tipe tidak dikenal
    }
}

/**
 * Bersihkan HTML Moodle dari teks soal (simpel, tanpa library)
 */
function stripHtml(html) {
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

/**
 * mdl_question columns (positional):
 * 0:id, 1:category, 2:name, 3:questiontext, 4:questiontextformat,
 * 5:generalfeedback, 6:generalfeedbackformat, 7:defaultmark, 8:penalty,
 * 9:qtype, 10:length, 11:stamp, 12:timecreated, 13:timemodified,
 * 14:createdby, 15:modifiedby
 */
function transformQuestion(row) {
    const id          = parseInt(row[0]);
    const categoryId  = parseInt(row[1]);
    const name        = row[2] || '';
    const content     = row[3] || '';
    const defaultMark = parseFloat(row[7]) || 1;
    const penalty     = parseFloat(row[8]) || 0;
    const qtype       = row[9];
    const createdBy   = parseInt(row[14]) || null;

    const type = mapQuestionType(qtype);
    if (!type) return null;

    return {
        moodle_id:    id,
        moodle_cat:   categoryId,
        type,
        content:      content.trim(),
        name,
        default_marks: defaultMark,
        penalty:      Math.min(penalty * defaultMark, defaultMark), // Moodle penalty adalah fraction
        created_by:   createdBy
    };
}

/**
 * mdl_question_answers columns:
 * 0:id, 1:question, 2:answer, 3:answerformat, 4:fraction, 5:feedback, 6:feedbackformat
 */
function transformAnswers(rows, moodleQuestionId) {
    return rows
        .filter(r => parseInt(r[1]) === moodleQuestionId)
        .map(r => ({
            id:       parseInt(r[0]),
            text:     (r[2] || '').trim(),
            fraction: parseFloat(r[4]) || 0
        }))
        .sort((a, b) => a.id - b.id);
}

// =====================================================================
// 3. INSERT ke Fikra DB
// =====================================================================

async function insertQuestion(conn, q, categoryMap) {
    // Map category Moodle ke category Fikra — pakai null jika tidak ada
    const categoryId = categoryMap[q.moodle_cat] || null;

    const [result] = await conn.execute(
        `INSERT INTO questions
         (category_id, type, content, difficulty, default_marks, penalty, created_by, is_active)
         VALUES (?, ?, ?, 'medium', ?, ?, ?, 1)`,
        [categoryId, q.type, q.content, q.default_marks, q.penalty, q.created_by]
    );
    return result.insertId;
}

async function insertOptions(conn, questionId, answers, qtype) {
    if (['mcq_single', 'mcq_multi', 'true_false'].includes(qtype)) {
        for (let i = 0; i < answers.length; i++) {
            const a = answers[i];
            const isCorrect = a.fraction >= 1.0 ? 1 : 0;
            await conn.execute(
                `INSERT INTO question_options (question_id, content, is_correct, sort_order)
                 VALUES (?, ?, ?, ?)`,
                [questionId, a.text, isCorrect, i + 1]
            );
        }
    } else if (['short_answer', 'numeric'].includes(qtype)) {
        for (const a of answers) {
            if (!a.text) continue;
            if (qtype === 'numeric') {
                const num = parseFloat(a.text);
                if (!isNaN(num)) {
                    await conn.execute(
                        `INSERT INTO question_answers
                         (question_id, numeric_value, numeric_tolerance, match_type)
                         VALUES (?, ?, 0, 'exact')`,
                        [questionId, num]
                    );
                }
            } else {
                await conn.execute(
                    `INSERT INTO question_answers
                     (question_id, answer_text, match_type)
                     VALUES (?, ?, 'case_insensitive')`,
                    [questionId, a.text]
                );
            }
        }
    }
}

// =====================================================================
// 4. MAIN
// =====================================================================

async function main() {
    console.log('📖 Membaca SQL backup...');
    if (!fs.existsSync(SQL_FILE)) {
        console.error(`❌ File tidak ditemukan: ${SQL_FILE}`);
        process.exit(1);
    }

    const sql = fs.readFileSync(SQL_FILE, 'utf8');
    console.log(`   File size: ${(sql.length / 1024 / 1024).toFixed(1)} MB`);

    // Parse semua tabel yang dibutuhkan
    console.log('\n🔍 Parsing tabel dari SQL backup...');

    const rawQuestions    = parseTable(sql, 'mdl_question');
    const rawAnswers      = parseTable(sql, 'mdl_question_answers');
    const rawCategories   = parseTable(sql, 'mdl_question_categories');
    const rawQuizSlots    = parseTable(sql, 'mdl_quiz_slots');
    const rawQuiz         = parseTable(sql, 'mdl_quiz');
    const rawQVersions    = parseTable(sql, 'mdl_question_versions');
    const rawQBankEntries = parseTable(sql, 'mdl_question_bank_entries');

    console.log(`   mdl_question:           ${rawQuestions.length} rows`);
    console.log(`   mdl_question_answers:   ${rawAnswers.length} rows`);
    console.log(`   mdl_question_categories:${rawCategories.length} rows`);
    console.log(`   mdl_quiz:               ${rawQuiz.length} rows`);
    console.log(`   mdl_quiz_slots:         ${rawQuizSlots.length} rows`);

    // Build question_version map: bank_entry_id -> question_id (latest)
    // mdl_question_versions: 0:id, 1:entryid, 2:questionid, 3:version, 4:status
    const latestVersion = {}; // entryid -> questionid
    for (const v of rawQVersions) {
        const entryId = parseInt(v[1]);
        const qId     = parseInt(v[2]);
        const ver     = parseInt(v[3]);
        if (!latestVersion[entryId] || ver > latestVersion[entryId].ver) {
            latestVersion[entryId] = { qId, ver };
        }
    }

    // mdl_question_bank_entries: 0:id, 1:questioncategoryid, 2:idnumber, 3:ownerid, 4:timecreated, 5:timemodified
    const bankEntryCategory = {}; // entryid -> categoryid
    for (const e of rawQBankEntries) {
        bankEntryCategory[parseInt(e[0])] = parseInt(e[1]);
    }

    // Set active question ids (via question_versions)
    const activeQuestionIds = new Set(
        Object.values(latestVersion).map(v => v.qId)
    );

    // Build answers map: moodle_question_id -> answers[]
    const answersMap = {};
    for (const row of rawAnswers) {
        const qid = parseInt(row[1]);
        if (!answersMap[qid]) answersMap[qid] = [];
        answersMap[qid].push(row);
    }

    // mdl_question_categories: 0:id, 1:courseid, 2:name, 3:info, ...
    // Kita tidak auto-create categories Moodle, cukup log
    console.log('\n📂 Kategori soal Moodle:');
    for (const c of rawCategories.slice(0, 20)) {
        console.log(`   [${c[0]}] ${c[2]}`);
    }

    // Transform questions
    const questions = [];
    for (const row of rawQuestions) {
        if (!activeQuestionIds.has(parseInt(row[0])) && activeQuestionIds.size > 0) continue;
        const q = transformQuestion(row);
        if (!q) continue;
        const answers = (answersMap[q.moodle_id] || []).map(r => ({
            id: parseInt(r[0]), text: (r[2] || '').trim(), fraction: parseFloat(r[4]) || 0
        })).sort((a,b) => a.id - b.id);
        q.answers = answers;
        questions.push(q);
    }

    console.log(`\n✅ ${questions.length} soal siap dimigrasi`);
    console.log('   Breakdown tipe:');
    const typeCounts = {};
    for (const q of questions) {
        typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;
    }
    for (const [t, c] of Object.entries(typeCounts)) {
        console.log(`     ${t}: ${c}`);
    }

    // Konfirmasi
    console.log('\n⚠️  Script akan INSERT soal ke database Fikra.');
    console.log('   Pastikan migration 003 sudah dijalankan.');
    console.log('   Tekan Ctrl+C dalam 5 detik untuk batal...');
    await new Promise(r => setTimeout(r, 5000));

    // Connect DB
    console.log('\n🔌 Connecting ke database...');
    const conn = await mysql.createConnection(DB_CONFIG);

    // Cek apakah sudah ada soal (hindari duplikasi)
    const [[{ count }]] = await conn.execute('SELECT COUNT(*) as count FROM questions');
    if (parseInt(count) > 0) {
        console.log(`\n⚠️  Database sudah memiliki ${count} soal.`);
        console.log('   Lanjut akan menambahkan soal baru (tidak menghapus yang lama).');
    }

    // Insert questions
    console.log('\n💾 Inserting soal...');
    let inserted = 0;
    let skipped  = 0;
    const moodleIdToFikraId = {}; // untuk mapping quiz slots nanti

    for (const q of questions) {
        try {
            const [result] = await conn.execute(
                `INSERT INTO questions
                 (category_id, type, content, difficulty, default_marks, penalty, created_by, is_active)
                 VALUES (?, ?, ?, 'medium', ?, ?, ?, 1)`,
                [null, q.type, q.content, q.default_marks, q.penalty, q.created_by]
            );
            const fikraId = result.insertId;
            moodleIdToFikraId[q.moodle_id] = fikraId;

            // Insert options/answers
            await insertOptions(conn, fikraId, q.answers, q.type);
            inserted++;

            if (inserted % 50 === 0) {
                process.stdout.write(`\r   ${inserted}/${questions.length} soal...`);
            }
        } catch (err) {
            console.warn(`\n   ⚠️ Skip soal moodle_id=${q.moodle_id}: ${err.message}`);
            skipped++;
        }
    }
    console.log(`\n   ✅ ${inserted} soal berhasil diinsert, ${skipped} dilewati.`);

    // =====================================================================
    // Migrasi Quiz → Tryouts
    // =====================================================================
    console.log('\n💾 Inserting tryout dari mdl_quiz...');

    // mdl_quiz: 0:id, 1:course, 2:name, 3:intro, 4:introformat,
    //           5:timeopen, 6:timeclose, 7:timelimit, ...
    const moodleQuizToTryoutId = {};

    for (const quiz of rawQuiz) {
        const moodleQuizId = parseInt(quiz[0]);
        const name         = quiz[2] || `Quiz ${moodleQuizId}`;
        const timeopen     = parseInt(quiz[5]) || 0;
        const timeclose    = parseInt(quiz[6]) || 0;
        const timelimit    = parseInt(quiz[7]) || 0;
        const startAt      = timeopen  > 0 ? new Date(timeopen  * 1000).toISOString().slice(0,19).replace('T',' ') : null;
        const endAt        = timeclose > 0 ? new Date(timeclose * 1000).toISOString().slice(0,19).replace('T',' ') : null;
        const durationMin  = timelimit > 0 ? Math.round(timelimit / 60) : null;

        try {
            const [res] = await conn.execute(
                `INSERT INTO tryouts
                 (name, type, duration_minutes, start_at, end_at, status, shuffle_questions, shuffle_options, show_review, show_explanation)
                 VALUES (?, 'custom', ?, ?, ?, 'published', 0, 0, 1, 1)`,
                [name, durationMin, startAt, endAt]
            );
            moodleQuizToTryoutId[moodleQuizId] = res.insertId;
            console.log(`   ✅ Tryout "${name}" (moodle quiz_id=${moodleQuizId} → fikra tryout_id=${res.insertId})`);
        } catch (err) {
            console.warn(`   ⚠️ Skip quiz ${moodleQuizId}: ${err.message}`);
        }
    }

    // =====================================================================
    // Migrasi Quiz Slots → tryout_sections + tryout_section_questions
    // =====================================================================
    console.log('\n💾 Inserting tryout sections & soal...');

    // Group slots by quiz
    // mdl_quiz_slots: 0:id, 1:slot, 2:quizid, 3:page, 4:requireprevious, 5:maxmark, 6:displaynumber
    // Perlu join dengan mdl_question_set_references dan mdl_question_references untuk dapat question_id
    // Alternatif: pakai mdl_question_attempts untuk tahu soal mana yang ada di quiz
    // Kita pakai mdl_question_references: 0:id, 1:usingcontextid, 2:component, 3:questionarea, 4:itemid(=slot_id), 5:questionbankentryid, 6:version

    const rawQRefs = parseTable(sql, 'mdl_question_references');
    console.log(`   mdl_question_references: ${rawQRefs.length} rows`);

    // Build: slot_id -> bank_entry_id
    const slotToBankEntry = {};
    for (const ref of rawQRefs) {
        if (ref[2] === 'mod_quiz' && ref[3] === 'slot') {
            slotToBankEntry[parseInt(ref[4])] = parseInt(ref[5]);
        }
    }

    // Group slots by quiz_id
    const slotsByQuiz = {};
    for (const slot of rawQuizSlots) {
        const slotId  = parseInt(slot[0]);
        const slotNum = parseInt(slot[1]);
        const quizId  = parseInt(slot[2]);
        const page    = parseInt(slot[3]);
        if (!slotsByQuiz[quizId]) slotsByQuiz[quizId] = [];
        slotsByQuiz[quizId].push({ slotId, slotNum, quizId, page });
    }

    for (const [moodleQuizId, slots] of Object.entries(slotsByQuiz)) {
        const tryoutId = moodleQuizToTryoutId[parseInt(moodleQuizId)];
        if (!tryoutId) continue;

        // Buat satu section default per tryout
        const [secRes] = await conn.execute(
            `INSERT INTO tryout_sections (tryout_id, name, sort_order, total_questions)
             VALUES (?, 'Semua Soal', 1, ?)`,
            [tryoutId, slots.length]
        );
        const sectionId = secRes.insertId;

        // Map slots ke soal Fikra
        let sortOrder = 0;
        for (const slot of slots.sort((a,b) => a.slotNum - b.slotNum)) {
            const bankEntryId = slotToBankEntry[slot.slotId];
            if (!bankEntryId) continue;
            const latestQ = latestVersion[bankEntryId];
            if (!latestQ) continue;
            const fikraQId = moodleIdToFikraId[latestQ.qId];
            if (!fikraQId) continue;

            sortOrder++;
            try {
                await conn.execute(
                    `INSERT INTO tryout_section_questions (section_id, question_id, sort_order, marks, penalty)
                     VALUES (?, ?, ?, 1.00, 0.00)`,
                    [sectionId, fikraQId, sortOrder]
                );
            } catch (err) {
                // Skip duplikat
            }
        }
        console.log(`   ✅ Tryout ${tryoutId}: section ${sectionId} dengan ${sortOrder} soal`);
    }

    await conn.end();
    console.log('\n🎉 Migrasi selesai!');
    console.log('   Jalankan: node backend/scripts/migrate.js untuk apply schema migrations terlebih dahulu jika belum.');
}

main().catch(err => {
    console.error('\n❌ Fatal error:', err.message);
    console.error(err.stack);
    process.exit(1);
});
