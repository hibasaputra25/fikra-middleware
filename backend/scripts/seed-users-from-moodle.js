/**
 * seed-users-from-moodle.js
 *
 * Migrasi data user dari Moodle (SQL backup) ke tabel users lokal.
 * Script ini:
 * 1. Parse mdl_user dari SQL backup
 * 2. Import siswa, guru, dan admin ke tabel users
 * 3. Set password default: NIM/username + '123' (harus diganti user)
 *
 * Usage:
 *   node backend/scripts/seed-users-from-moodle.js
 *
 * Setelah migrasi, minta semua user reset password via fitur change-password.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs     = require('fs');
const path   = require('path');
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const SQL_FILE = path.join(__dirname, '..', '..', 'moodle_backup_21_04_2026.sql');
const DB_CONFIG = {
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT || 3306,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
};

// Moodle course ID yang dipakai
const MOODLE_COURSE_ID = parseInt(process.env.MOODLE_COURSE_ID || '2');

// =====================================================================
// PARSER
// =====================================================================

function parseValuesBlock(block) {
    const rows = [];
    let i = 0;
    const len = block.length;
    while (i < len) {
        while (i < len && (block[i] === ',' || block[i] === '\n' || block[i] === '\r' || block[i] === ' ')) i++;
        if (i >= len) break;
        if (block[i] !== '(') { i++; continue; }
        i++;
        const row = [];
        while (i < len && block[i] !== ')') {
            while (i < len && block[i] === ' ') i++;
            if (block[i] === "'") {
                i++;
                let val = '';
                while (i < len) {
                    if (block[i] === '\\') {
                        const next = block[i + 1];
                        if (next === "'") { val += "'"; i += 2; }
                        else if (next === '\\') { val += '\\'; i += 2; }
                        else if (next === 'n') { val += '\n'; i += 2; }
                        else if (next === 'r') { val += '\r'; i += 2; }
                        else { val += block[i]; i++; }
                    } else if (block[i] === "'" && block[i+1] === "'") {
                        val += "'"; i += 2;
                    } else if (block[i] === "'") {
                        i++; break;
                    } else {
                        val += block[i++];
                    }
                }
                row.push(val);
            } else {
                let val = '';
                while (i < len && block[i] !== ',' && block[i] !== ')') val += block[i++];
                row.push(val.trim() === 'NULL' ? null : val.trim());
            }
            while (i < len && block[i] === ' ') i++;
            if (i < len && block[i] === ',') i++;
        }
        if (block[i] === ')') i++;
        if (row.length > 0) rows.push(row);
    }
    return rows;
}

function parseTable(sql, tableName) {
    const marker = `INSERT INTO \`${tableName}\` VALUES `;
    const rows = [];
    let pos = 0;
    while (true) {
        const idx = sql.indexOf(marker, pos);
        if (idx === -1) break;
        const end = sql.indexOf(';', idx);
        rows.push(...parseValuesBlock(sql.slice(idx + marker.length, end)));
        pos = end + 1;
    }
    return rows;
}

// =====================================================================
// MAIN
// =====================================================================

async function main() {
    console.log('\ud83d\udcd6 Membaca SQL backup...');
    if (!fs.existsSync(SQL_FILE)) {
        console.error(`\u274c File tidak ditemukan: ${SQL_FILE}`);
        process.exit(1);
    }
    const sql = fs.readFileSync(SQL_FILE, 'utf8');
    console.log(`   File: ${(sql.length / 1024 / 1024).toFixed(1)} MB`);

    // Parse tabel yang dibutuhkan
    console.log('\n\ud83d\udd0d Parsing mdl_user, mdl_role_assignments, mdl_role...');
    const rawUsers       = parseTable(sql, 'mdl_user');
    const rawRoleAssign  = parseTable(sql, 'mdl_role_assignments');
    const rawRoles       = parseTable(sql, 'mdl_role');
    const rawContext     = parseTable(sql, 'mdl_context');

    console.log(`   mdl_user:             ${rawUsers.length} rows`);
    console.log(`   mdl_role_assignments: ${rawRoleAssign.length} rows`);
    console.log(`   mdl_role:             ${rawRoles.length} rows`);
    console.log(`   mdl_context:          ${rawContext.length} rows`);

    // Build role map: role_id -> shortname
    // mdl_role: 0:id, 1:name, 2:shortname, ...
    const roleMap = {};
    for (const r of rawRoles) roleMap[parseInt(r[0])] = r[2]; // shortname

    // Build context map untuk course: context_id -> course_id
    // mdl_context: 0:id, 1:contextlevel, 2:instanceid, ...
    // contextlevel 50 = course
    const courseContextIds = new Set();
    for (const c of rawContext) {
        if (parseInt(c[1]) === 50 && parseInt(c[2]) === MOODLE_COURSE_ID) {
            courseContextIds.add(parseInt(c[0]));
        }
    }
    console.log(`   Course context IDs for course ${MOODLE_COURSE_ID}: ${[...courseContextIds].join(', ')}`);

    // Build user role map: moodle_user_id -> role di course
    // mdl_role_assignments: 0:id, 1:roleid, 2:contextid, 3:userid, ...
    const userRoleMap = {};
    for (const ra of rawRoleAssign) {
        const contextId = parseInt(ra[2]);
        if (!courseContextIds.has(contextId)) continue;
        const userId = parseInt(ra[3]);
        const roleShortname = roleMap[parseInt(ra[1])] || 'student';
        // Priority: manager > editingteacher > teacher > student
        const priority = { manager: 4, coursecreator: 3, editingteacher: 2, teacher: 1, student: 0 };
        const current = userRoleMap[userId];
        if (!current || (priority[roleShortname] || 0) > (priority[current] || 0)) {
            userRoleMap[userId] = roleShortname;
        }
    }

    // Map Moodle role -> Fikra role
    function mapRole(moodleRole) {
        if (['manager', 'coursecreator'].includes(moodleRole)) return 'admin';
        if (['editingteacher', 'teacher'].includes(moodleRole)) return 'guru';
        return 'siswa';
    }

    // Filter users yang terdaftar di course
    // mdl_user: 0:id, 1:auth, 2:confirmed, 3:policyagreed, 4:deleted,
    //           5:suspended, 6:mnethostid, 7:username, 8:password,
    //           9:idnumber, 10:firstname, 11:lastname, 12:email, ...
    const enrolledUserIds = new Set(Object.keys(userRoleMap).map(Number));

    const usersToImport = rawUsers.filter(u => {
        const id      = parseInt(u[0]);
        const deleted = parseInt(u[4]) || 0;
        const suspend = parseInt(u[5]) || 0;
        const username = u[7] || '';
        // Skip deleted, suspended, guest, admin bawaan Moodle
        if (deleted || suspend) return false;
        if (['guest', 'admin'].includes(username)) return false;
        // Hanya user yang enrolled di course
        return enrolledUserIds.has(id);
    });

    console.log(`\n\u2705 ${usersToImport.length} user akan diimport (dari ${rawUsers.length} total)`);

    if (usersToImport.length === 0) {
        console.log('\u26a0\ufe0f  Tidak ada user untuk diimport.');
        console.log('   Kemungkinan course context tidak ditemukan.');
        console.log('   Akan import SEMUA user non-guest, non-deleted...');

        // Fallback: import semua user aktif
        const allActive = rawUsers.filter(u => {
            const deleted  = parseInt(u[4]) || 0;
            const suspend  = parseInt(u[5]) || 0;
            const username = u[7] || '';
            return !deleted && !suspend && !['guest'].includes(username);
        });
        console.log(`   ${allActive.length} user aktif ditemukan`);
        usersToImport.push(...allActive);
    }

    console.log('\n\u26a0\ufe0f  Password default: username + "@Fikra123"');
    console.log('   Minta semua user reset password setelah login pertama.');
    console.log('   Tekan Ctrl+C dalam 5 detik untuk batal...');
    await new Promise(r => setTimeout(r, 5000));

    const conn = await mysql.createConnection(DB_CONFIG);

    // Pastikan tabel users ada
    const [[{ cnt }]] = await conn.execute('SELECT COUNT(*) as cnt FROM users');
    if (parseInt(cnt) > 0) {
        console.log(`\n\u26a0\ufe0f  Tabel users sudah ada ${cnt} user. Import hanya menambah user baru (skip duplikat).`);
    }

    let inserted = 0;
    let skipped  = 0;
    const BCRYPT_ROUNDS = 10; // lebih rendah untuk speed bulk insert

    console.log('\n\ud83d\udcbe Inserting users...');
    for (const u of usersToImport) {
        const moodleId  = parseInt(u[0]);
        const username  = u[7] || '';
        const firstName = u[10] || '';
        const lastName  = u[11] || '';
        const email     = u[12] || `${username}@fikra.local`;
        const nama      = `${firstName} ${lastName}`.trim() || username;
        const moodleRole = userRoleMap[moodleId] || 'student';
        const role      = mapRole(moodleRole);

        if (!username || !email) { skipped++; continue; }

        // Password default: username + "@Fikra123"
        const defaultPassword = `${username}@Fikra123`;
        const passwordHash    = await bcrypt.hash(defaultPassword, BCRYPT_ROUNDS);

        try {
            await conn.execute(
                `INSERT IGNORE INTO users
                 (username, email, password_hash, nama, role, moodle_id, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, 1)`,
                [username, email, passwordHash, nama, role, moodleId]
            );
            inserted++;
            process.stdout.write(`\r   ${inserted}/${usersToImport.length} users...`);
        } catch (err) {
            skipped++;
        }
    }

    console.log(`\n\n\u2705 ${inserted} user berhasil diimport, ${skipped} dilewati.`);

    // Tampilkan summary per role
    const [summary] = await conn.execute(
        'SELECT role, COUNT(*) as cnt FROM users GROUP BY role'
    );
    console.log('\nRingkasan user per role:');
    for (const s of summary) console.log(`   ${s.role}: ${s.cnt}`);

    await conn.end();
    console.log('\n\ud83c\udf89 Seeder selesai!');
    console.log('   Langkah selanjutnya: jalankan migration 004 terlebih dahulu jika belum.');
    console.log('   node backend/scripts/migrate.js');
}

main().catch(err => {
    console.error('\n\u274c Fatal:', err.message);
    process.exit(1);
});
