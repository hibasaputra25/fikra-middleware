require('dotenv').config();
const axios = require('axios');
const mysql = require('mysql2/promise');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- CONFIGURATION ---
const MOODLE_URL = process.env.MOODLE_URL;
const MOODLE_TOKEN = process.env.MOODLE_TOKEN;

const DB_CONFIG = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
};

// --- 1. FUNGSI API MOODLE ---
async function panggilAPI(fungsi, parameter) {
    const response = await axios.get(MOODLE_URL, {
        params: { wstoken: MOODLE_TOKEN, wsfunction: fungsi, moodlewsrestformat: 'json', ...parameter }
    });
    if (response.data.exception) throw new Error(response.data.message);
    return response.data;
}

// --- 2. FUNGSI ANALISIS AI (GROQ) ---
async function mintaAnalisisAI(nama, skorTotal, rekap) {
    try {
        const ringkasanSkor = Object.entries(rekap)
            .map(([k, v]) => `${k}: ${v.benar}/${v.total}`)
            .join(', ');

        const prompt = `Analisis UTBK ${nama}. Skor: ${skorTotal.toFixed(2)}. Detail: ${ringkasanSkor}. 
        Berikan 2 kalimat penyemangat dan 1 saran belajar spesifik untuk subtes terendah. 
        Gunakan gaya bahasa seorang pelatih yang tegas, penuh energi, dan fokus pada strategi pemenangan. Gunakan kata-kata yang memacu adrenalin. Sedikit gunakan bahasa khas gen-z namun tetap sopan`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile', 
            temperature: 0.7,
        });

        return chatCompletion.choices[0].message.content;

    } catch (error) {
        console.error(`   ⚠️ Groq Error: ${error.message}`);
        if (error.message.includes('rate_limit')) return "Sabar ya, AI lagi istirahat sebentar (Rate Limit).";
        return "Gagal generate analisis AI.";
    }
}

// --- 3. FUNGSI SIMPAN KE MARIADB ---
async function simpanKeDatabase(data) {
    let conn;
    try {
        conn = await mysql.createConnection(DB_CONFIG);

        const query = `
            INSERT INTO tryout_results 
            (user_id, student_name, quiz_id, attempt_id, total_score, subtest_scores, ai_analysis) 
            VALUES (?, ?, ?, ?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE 
                student_name = VALUES(student_name),
                total_score = VALUES(total_score), 
                subtest_scores = VALUES(subtest_scores),
                ai_analysis = VALUES(ai_analysis)
        `;
        
        await conn.execute(query, [
            data.user_id, 
            data.student_name, 
            data.quiz_id, 
            data.attempt_id, 
            data.nilai_akhir, 
            JSON.stringify(data.rekap_subtes), 
            data.analisis_ai
        ]);

        console.log(`💾 Data ${data.student_name} berhasil diamankan!`);
    } catch (error) {
        console.error('❌ Gagal simpan ke DB:', error.message);
    } finally {
        if (conn) await conn.end();
    }
}

// --- 4. FUNGSI MAPPING SUBTES (Untuk TO 7) ---
function tentukanSubtes(no) {
    if (no <= 20) return "PBM"; 
    if (no <= 40) return "PPU";
    if (no <= 60) return "PK"; 
    if (no <= 80) return "PM";
    if (no <= 110) return "PU"; 
    if (no <= 135) return "LBI";
    return "LBE";
}

// --- MAIN PROCESS (THE LOOP) ---
async function jalankanETL(courseId, quizId) {
    try {
        console.log(`🚀 Memulai ETL untuk Quiz ID: ${quizId}...`);
        const users = await panggilAPI('core_enrol_get_enrolled_users', { courseid: courseId });
        
        for (const user of users) {
            const res = await panggilAPI('mod_quiz_get_user_attempts', { quizid: quizId, userid: user.id, status: 'finished' });
            
            if (res.attempts && res.attempts.length > 0) {
                const attempt = res.attempts[res.attempts.length - 1];
                console.log(`\n📦 Memproses: ${user.fullname}`);

                // --- 1. EXTRACT & TRANSFORM DATA ---
                const review = await panggilAPI('mod_quiz_get_attempt_review', { attemptid: attempt.id });
                let totalSkor = 0, totalMaks = 0, noAsli = 0;
                
                // Siapkan wadah rekap
                const rekap = { 
                    PBM:{benar:0,total:0}, PPU:{benar:0,total:0}, PK:{benar:0,total:0}, 
                    PU:{benar:0,total:0}, LBI:{benar:0,total:0}, LBE:{benar:0,total:0}, PM:{benar:0,total:0} 
                };

                for (const s of review.questions) {
                    const max = parseFloat(s.maxmark) || 0;
                    if (max > 0) {
                        noAsli++;
                        const mark = parseFloat(s.mark) || 0;
                        const sub = tentukanSubtes(noAsli);
                        
                        if (rekap[sub]) {
                            rekap[sub].total += max; 
                            rekap[sub].benar += mark;
                        }
                        totalSkor += mark; 
                        totalMaks += max;
                    }
                }

                const nilaiAkhir = totalMaks > 0 ? (totalSkor / totalMaks) * 100 : 0;

                // --- 2. DAPATKAN ANALISIS AI ---
                console.log(`🤖 Meminta wejangan AI untuk ${user.fullname}...`);
                const analisisAI = await mintaAnalisisAI(user.fullname, nilaiAkhir, rekap);

                // --- 3. SIMPAN KE DATABASE ---
                await simpanKeDatabase({
                    user_id: user.id,
                    student_name: user.fullname, 
                    quiz_id: quizId,
                    attempt_id: attempt.id,
                    nilai_akhir: nilaiAkhir,
                    rekap_subtes: rekap,
                    analisis_ai: analisisAI
                });
            }
        }
        console.log("\n✨ PROSES SELESAI!");
    } catch (e) { 
        console.error("❌ Error:", e.message); 
    }
}

// Jalankan untuk Quiz ID 7
jalankanETL(2, 4);