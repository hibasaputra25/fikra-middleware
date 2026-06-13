// Script one-off untuk jalankan schema.sql ke database
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

async function run() {
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log(`Connecting to ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}...`);
    const conn = await mysql.createConnection(DB_CONFIG);

    try {
        console.log('Executing schema.sql...');
        const results = await conn.query(sql);
        const stmtCount = Array.isArray(results[0]) ? results[0].length : 1;
        console.log(`✅ Schema applied successfully (${stmtCount} statement groups).`);

        // Verifikasi tabel terbuat
        const [tables] = await conn.query('SHOW TABLES');
        console.log(`\n📋 Tables in database (${tables.length} total):`);
        tables.forEach(row => {
            const tableName = Object.values(row)[0];
            console.log(`  - ${tableName}`);
        });

        const [categories] = await conn.query(
            "SELECT code, name FROM categories WHERE level = 'subtes' ORDER BY sort_order"
        );
        console.log(`\n🌱 Subtes seed data (${categories.length} rows):`);
        categories.forEach(c => console.log(`  - ${c.code}: ${c.name}`));
    } catch (err) {
        console.error('❌ Failed to apply schema:', err.message);
        process.exitCode = 1;
    } finally {
        await conn.end();
    }
}

run();
