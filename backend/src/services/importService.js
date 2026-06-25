const { pool } = require('../config/db');
const xlsx    = require('xlsx');

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
    return xml.slice(contentStart, end)
        .replace(/<\!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .trim();
}

function getAllBlocks(xml, tag) {
    const close = `</${tag}>`;
    const blocks = [];
    let pos = 0;
    // Regex yang match <tag> atau <tag ...> tapi BUKAN <tagXxx>
    const openRe = new RegExp(`<${tag}(?=[\\s>])`, 'g');
    while (true) {
        openRe.lastIndex = pos;
        const m = openRe.exec(xml);
        if (!m) break;
        const start = m.index;
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

// =====================================================================
// MOODLE XML PARSER
// =====================================================================

/**
 * Parse Moodle XML export ke array of question objects
 * Support format: export dari Moodle question bank
 */
function parseMoodleXml(xmlContent) {
    const questions = [];
    const errors    = [];

    // Track kategori aktif — category blocks mendahului soal-soal dalam kategorinya
    let currentCategoryPath = null;

    // Ambil semua blok <question type="...">
    const qBlocks = getAllBlocks(xmlContent, 'question');

    for (const block of qBlocks) {
        try {
            const typeAttr = block.match(/^<question[^>]+type="([^"]+)"/);
            if (!typeAttr) continue;
            const moodleType = typeAttr[1];

            // Update kategori aktif dari category block
            if (moodleType === 'category') {
                const catBlock = getTagValue(block, 'category');
                if (catBlock) {
                    const rawPath = decodeEntities(getTagValue(catBlock, 'text') || '');
                    // Hapus prefix $module$/top/ atau $course$/
                    currentCategoryPath = rawPath
                        .replace(/^\$[^$]+\$\/top\//i, '')
                        .replace(/^\$[^$]+\$\//i, '')
                        .trim();
                }
                continue;
            }

            // Skip tipe tidak dikenal
            if (moodleType === 'description') continue;
            const type = mapQtype(moodleType);
            if (!type) continue;

            // Konten soal
            const nameBlock  = getTagValue(block, 'name');
            const name       = nameBlock ? (getTagValue(nameBlock, 'text') || nameBlock) : '';
            const qtextBlock = getTagValue(block, 'questiontext');
            const content    = qtextBlock
                ? decodeEntities(getTagValue(qtextBlock, 'text') || qtextBlock)
                : decodeEntities(name);

            if (!content && !name) { errors.push('Soal tanpa konten dilewati'); continue; }

            // Feedback/explanation
            const feedbackBlock  = getTagValue(block, 'generalfeedback');
            const explanation    = feedbackBlock
                ? decodeEntities(getTagValue(feedbackBlock, 'text') || '')
                : null;

            // Marks & penalty
            const defaultMark = parseFloat(getTagValue(block, 'defaultgrade') || '1') || 1;
            const penalty     = parseFloat(getTagValue(block, 'penalty') || '0') || 0;

            // Kategori dari current tracking atau dari block sendiri
            const categoryPath = currentCategoryPath || null;

            // Parse jawaban / opsi
            // Hapus <correctfeedback>, <partiallycorrectfeedback>, <incorrectfeedback>
            // sebelum parsing agar <text> di dalamnya tidak ikut terbaca sebagai opsi
            const blockNoMeta = block
                .replace(/<correctfeedback[^>]*>[\s\S]*?<\/correctfeedback>/g, '')
                .replace(/<partiallycorrectfeedback[^>]*>[\s\S]*?<\/partiallycorrectfeedback>/g, '')
                .replace(/<incorrectfeedback[^>]*>[\s\S]*?<\/incorrectfeedback>/g, '');

            const answers = [];
            const answerBlocks = getAllBlocks(blockNoMeta, 'answer');

            for (const ab of answerBlocks) {
                const fracAttr = ab.match(/^<answer[^>]+fraction="([^"]+)"/);
                const fraction = fracAttr ? parseFloat(fracAttr[1]) : 0;

                // Hapus <feedback> di dalam <answer> sebelum ambil <text>
                const abNoFeedback = ab.replace(/<feedback[^>]*>[\s\S]*?<\/feedback>/g, '');
                const textBlock = getTagValue(abNoFeedback, 'text');
                const text = decodeEntities(textBlock || '').trim();
                if (!text) continue;
                answers.push({ text, fraction: fraction / 100 }); // fraction 0-100 -> 0-1
            }

            // Untuk numerical: toleransi
            const numerics = [];
            if (type === 'numeric') {
                for (const ab of answerBlocks) {
                    const textBlock = getTagValue(ab, 'text');
                    const toleranceBlock = getTagValue(ab, 'tolerance');
                    const num = parseFloat(decodeEntities(textBlock || ''));
                    const tol = parseFloat(toleranceBlock || '0');
                    if (!isNaN(num)) numerics.push({ answer: num, tolerance: tol });
                }
            }

            questions.push({
                name,
                content: content || name,
                type,
                default_marks: defaultMark,
                penalty: penalty * defaultMark,
                explanation: explanation || null,
                category_path: categoryPath,
                answers,
                numerics
            });
        } catch (err) {
            errors.push(`Parse error: ${err.message}`);
        }
    }

    return { questions, errors };
}

// =====================================================================
// CSV PARSER
// =====================================================================

/**
 * Parse CSV/Excel import.
 * Format kolom yang didukung:
 *   type, content, option_a, option_b, option_c, option_d, option_e,
 *   correct_answer, explanation, difficulty, category, default_marks, penalty
 *
 * correct_answer untuk MCQ: A/B/C/D/E atau multiple: A,C
 * Untuk short_answer: isi teks jawaban di kolom correct_answer
 * Untuk numeric: isi angka di correct_answer, toleransi di kolom tolerance
 */
function parseCsv(buffer, extension) {
    const questions = [];
    const errors    = [];

    let rows;
    try {
        const wb   = xlsx.read(buffer, { type: 'buffer' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
    } catch (err) {
        return { questions: [], errors: [`Gagal membaca file: ${err.message}`] };
    }

    const OPTION_COLS = ['option_a','option_b','option_c','option_d','option_e'];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // +2 karena header di row 1
        try {
            const type    = mapQtype((row.type || '').toLowerCase().trim()) || 'mcq_single';
            const content = String(row.content || row.question || '').trim();
            if (!content) { errors.push(`Row ${rowNum}: kolom content/question kosong, dilewati`); continue; }

            const explanation  = String(row.explanation || '').trim() || null;
            const defaultMark  = parseFloat(row.default_marks || row.marks || '1') || 1;
            const penalty      = parseFloat(row.penalty || '0') || 0;
            const difficulty   = ['easy','medium','hard'].includes(row.difficulty) ? row.difficulty : 'medium';
            const categoryPath = String(row.category || '').trim() || null;

            const answers = [];

            if (type === 'mcq_single' || type === 'mcq_multi' || type === 'true_false') {
                const correctRaw = String(row.correct_answer || '').toUpperCase().trim();
                const correctSet = new Set(correctRaw.split(',').map(s => s.trim()).filter(Boolean));

                OPTION_COLS.forEach((col, idx) => {
                    const text = String(row[col] || '').trim();
                    if (!text) return;
                    const letter = String.fromCharCode(65 + idx); // A, B, C...
                    const isCorrect = correctSet.has(letter);
                    answers.push({ text, fraction: isCorrect ? 1 : 0 });
                });

                if (answers.length === 0) {
                    errors.push(`Row ${rowNum}: tidak ada opsi jawaban`);
                    continue;
                }
            } else if (type === 'short_answer') {
                const ans = String(row.correct_answer || '').trim();
                if (ans) answers.push({ text: ans, fraction: 1 });
            } else if (type === 'numeric') {
                const num = parseFloat(row.correct_answer || '0');
                const tol = parseFloat(row.tolerance || '0');
                if (!isNaN(num)) answers.push({ text: String(num), fraction: 1, tolerance: tol });
            }

            questions.push({
                name:          content.slice(0, 100),
                content,
                type,
                default_marks: defaultMark,
                penalty,
                difficulty,
                explanation,
                category_path: categoryPath,
                answers,
                numerics:      []
            });
        } catch (err) {
            errors.push(`Row ${rowNum}: ${err.message}`);
        }
    }

    return { questions, errors };
}

// =====================================================================
// RESOLVE KATEGORI
// =====================================================================

/**
 * Resolve category_path dari Moodle ke category_id Fikra.
 * Path Moodle biasanya: "$course$/Default for xxx" atau "PAKET 1 / PENALARAN UMUM"
 */
async function resolveCategoryId(categoryPath, overrideCategoryId) {
    if (overrideCategoryId) return overrideCategoryId;
    if (!categoryPath) return null;

    const path = categoryPath.toLowerCase();

    const KEYWORD_MAP = [
        { keywords: ['penalaran umum', 'pbm'],                               code: 'PBM' },
        { keywords: ['pengetahuan dan pemahaman', 'ppu'],                    code: 'PPU' },
        { keywords: ['memahami bacaan', 'pemahaman bacaan', 'menulis', 'pk'], code: 'PK'  },
        { keywords: ['kuantitatif', 'pm', 'mtk okt', 'matematika snbt'],     code: 'PM'  },
        { keywords: ['penalaran matematika', 'pu'],                          code: 'PU'  },
        { keywords: ['literasi bahasa indonesia', 'lbi', 'indo okt'],        code: 'LBI' },
        { keywords: ['literasi bahasa inggris', 'lbe', 'ing okt', 'english'],code: 'LBE' },
    ];

    for (const { keywords, code } of KEYWORD_MAP) {
        if (keywords.some(kw => path.includes(kw))) {
            const [[cat]] = await pool.query(
                'SELECT id FROM categories WHERE code = ? LIMIT 1', [code]
            );
            if (cat) return cat.id;
        }
    }

    return null;
}

// =====================================================================
// INSERT ke DB
// =====================================================================

async function insertQuestions(questions, overrideCategoryId, collectionId, createdBy) {
    let inserted = 0;
    let skipped  = 0;
    const errors = [];

    for (const q of questions) {
        try {
            const categoryId = await resolveCategoryId(q.category_path, overrideCategoryId);
            const difficulty = ['easy','medium','hard'].includes(q.difficulty) ? q.difficulty : 'medium';

            const [result] = await pool.execute(
                `INSERT INTO questions
                 (category_id, type, content, explanation, difficulty,
                  default_marks, penalty, created_by, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [
                    categoryId,
                    q.type,
                    q.content,
                    q.explanation || null,
                    difficulty,
                    q.default_marks || 1,
                    q.penalty || 0,
                    createdBy || null
                ]
            );
            const qId = result.insertId;

            // Tambahkan ke collection jika dipilih
            if (collectionId) {
                await pool.execute(
                    `INSERT IGNORE INTO question_collection_items (collection_id, question_id)
                     VALUES (?, ?)`,
                    [collectionId, qId]
                ).catch(() => {}); // skip jika tabel tidak ada atau duplikat
            }

            // Insert opsi jawaban
            if (['mcq_single','mcq_multi','true_false'].includes(q.type)) {
                for (let i = 0; i < q.answers.length; i++) {
                    const a = q.answers[i];
                    const isCorrect = a.fraction >= 1.0 ? 1 : 0;
                    await pool.execute(
                        `INSERT INTO question_options (question_id, content, is_correct, sort_order)
                         VALUES (?, ?, ?, ?)`,
                        [qId, a.text, isCorrect, i + 1]
                    );
                }
            } else if (q.type === 'short_answer') {
                for (const a of q.answers) {
                    if (!a.text) continue;
                    await pool.execute(
                        `INSERT INTO question_answers (question_id, answer_text, match_type)
                         VALUES (?, ?, 'case_insensitive')`,
                        [qId, a.text]
                    );
                }
            } else if (q.type === 'numeric') {
                const numList = q.numerics?.length > 0 ? q.numerics :
                    q.answers.map(a => ({ answer: parseFloat(a.text), tolerance: a.tolerance || 0 }))
                              .filter(n => !isNaN(n.answer));
                for (const n of numList) {
                    await pool.execute(
                        `INSERT INTO question_answers
                         (question_id, numeric_value, numeric_tolerance, match_type)
                         VALUES (?, ?, ?, 'exact')`,
                        [qId, n.answer, n.tolerance || 0]
                    );
                }
            }

            inserted++;
        } catch (err) {
            skipped++;
            errors.push(err.message);
        }
    }

    return { inserted, skipped, errors };
}

// =====================================================================
// MAIN IMPORT FUNCTION
// =====================================================================

async function importQuestions({ buffer, filename, format, overrideCategoryId, collectionId, createdBy }) {
    let parsed;

    if (format === 'moodle_xml') {
        const xmlContent = buffer.toString('utf8');
        parsed = parseMoodleXml(xmlContent);
    } else if (format === 'csv' || format === 'excel') {
        const ext = filename.split('.').pop().toLowerCase();
        parsed = parseCsv(buffer, ext);
    } else {
        throw new Error(`Format tidak dikenal: ${format}`);
    }

    const { questions, errors: parseErrors } = parsed;

    if (questions.length === 0) {
        return {
            total_parsed: 0, total_inserted: 0,
            total_skipped: 0, total_errors: parseErrors.length,
            errors: parseErrors
        };
    }

    const { inserted, skipped, errors: insertErrors } = await insertQuestions(
        questions, overrideCategoryId, collectionId, createdBy
    );

    const allErrors = [...parseErrors, ...insertErrors];

    // Log ke import_logs
    const status = inserted === questions.length ? 'success'
        : inserted > 0 ? 'partial' : 'failed';

    await pool.execute(
        `INSERT INTO import_logs
         (filename, format, status, total_parsed, total_inserted, total_skipped,
          total_errors, category_id, errors, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            filename, format, status,
            questions.length, inserted, skipped,
            allErrors.length,
            overrideCategoryId || null,
            allErrors.length > 0 ? JSON.stringify(allErrors.slice(0, 50)) : null,
            createdBy || null
        ]
    );

    return {
        total_parsed:   questions.length,
        total_inserted: inserted,
        total_skipped:  skipped,
        total_errors:   allErrors.length,
        errors:         allErrors.slice(0, 20) // max 20 error di response
    };
}

async function getImportLogs(limit = 20) {
    const [rows] = await pool.query(
        `SELECT il.*, c.name AS category_name, c.code AS category_code
         FROM import_logs il
         LEFT JOIN categories c ON c.id = il.category_id
         ORDER BY il.created_at DESC
         LIMIT ?`,
        [limit]
    );
    return rows.map(r => ({
        ...r,
        errors: typeof r.errors === 'string' ? JSON.parse(r.errors) : (r.errors || [])
    }));
}

module.exports = { importQuestions, getImportLogs, parseMoodleXml, parseCsv };
