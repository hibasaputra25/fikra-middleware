// One-off: create fikra_academy DB and grant to moodleuser
const mysql = require('mysql2/promise');

(async () => {
    let conn;
    try {
        conn = await mysql.createConnection({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'rootpass123',
            multipleStatements: true,
        });
        console.log('OK root connected');

        await conn.query(
            "CREATE DATABASE IF NOT EXISTS fikra_academy DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        );
        console.log('OK database fikra_academy ready');

        await conn.query(
            "CREATE USER IF NOT EXISTS 'moodleuser'@'localhost' IDENTIFIED BY 'admin'"
        );
        console.log("OK user moodleuser ensured");

        await conn.query(
            "GRANT ALL PRIVILEGES ON fikra_academy.* TO 'moodleuser'@'localhost'"
        );
        console.log('OK grant fikra_academy.* to moodleuser');

        await conn.query('FLUSH PRIVILEGES');
        console.log('OK flush privileges');

        const [r] = await conn.query("SHOW DATABASES LIKE 'fikra_academy'");
        console.log('VERIFY DB:', r);
    } catch (e) {
        console.error('ERROR:', e.code || e.message);
        process.exitCode = 1;
    } finally {
        if (conn) await conn.end();
    }
})();
