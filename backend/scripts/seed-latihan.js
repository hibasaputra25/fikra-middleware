require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../src/config/db');

// 7 subtes SNBT utama
const SUBTES = [
    { category_id: 1,  code: 'PU',  name: 'Penalaran Umum' },
    { category_id: 2,  code: 'PPU', name: 'Pengetahuan dan Pemahaman Umum' },
    { category_id: 3,  code: 'PBM', name: 'Pemahaman Bacaan dan Menulis' },
    { category_id: 4,  code: 'PK',  name: 'Pengetahuan Kuantitatif' },
    { category_id: 5,  code: 'PM',  name: 'Penalaran Matematika' },
    { category_id: 6,  code: 'LBI', name: 'Literasi Bahasa Indonesia' },
    { category_id: 7,  code: 'LBE', name: 'Literasi Bahasa Inggris' },
];

// 5 soal per subtes
const SOAL = {
    PU: [
        {
            content: 'Semua mahasiswa adalah pelajar. Budi adalah mahasiswa. Kesimpulan yang tepat adalah...',
            options: [
                { label: 'A', content: 'Budi adalah pelajar', is_correct: true },
                { label: 'B', content: 'Budi bukan pelajar', is_correct: false },
                { label: 'C', content: 'Semua pelajar adalah mahasiswa', is_correct: false },
                { label: 'D', content: 'Budi mungkin bukan pelajar', is_correct: false },
                { label: 'E', content: 'Tidak dapat disimpulkan', is_correct: false },
            ]
        },
        {
            content: 'Jika hari ini hujan, maka jalanan basah. Jalanan tidak basah. Dapat disimpulkan bahwa...',
            options: [
                { label: 'A', content: 'Hari ini hujan', is_correct: false },
                { label: 'B', content: 'Hari ini tidak hujan', is_correct: true },
                { label: 'C', content: 'Jalanan selalu kering', is_correct: false },
                { label: 'D', content: 'Cuaca cerah', is_correct: false },
                { label: 'E', content: 'Tidak dapat disimpulkan', is_correct: false },
            ]
        },
        {
            content: 'Deret bilangan: 2, 4, 8, 16, 32, ... Bilangan berikutnya adalah...',
            options: [
                { label: 'A', content: '48', is_correct: false },
                { label: 'B', content: '56', is_correct: false },
                { label: 'C', content: '64', is_correct: true },
                { label: 'D', content: '72', is_correct: false },
                { label: 'E', content: '80', is_correct: false },
            ]
        },
        {
            content: 'Dalam sebuah kelas, 20 siswa suka matematika, 15 siswa suka fisika, dan 8 siswa suka keduanya. Berapa siswa yang suka matematika atau fisika?',
            options: [
                { label: 'A', content: '27', is_correct: true },
                { label: 'B', content: '35', is_correct: false },
                { label: 'C', content: '43', is_correct: false },
                { label: 'D', content: '28', is_correct: false },
                { label: 'E', content: '23', is_correct: false },
            ]
        },
        {
            content: 'A lebih tinggi dari B. C lebih pendek dari B. Urutan dari yang tertinggi ke terendah adalah...',
            options: [
                { label: 'A', content: 'B, A, C', is_correct: false },
                { label: 'B', content: 'A, C, B', is_correct: false },
                { label: 'C', content: 'A, B, C', is_correct: true },
                { label: 'D', content: 'C, B, A', is_correct: false },
                { label: 'E', content: 'C, A, B', is_correct: false },
            ]
        },
    ],
    PPU: [
        {
            content: 'Ibu kota Indonesia adalah...',
            options: [
                { label: 'A', content: 'Surabaya', is_correct: false },
                { label: 'B', content: 'Bandung', is_correct: false },
                { label: 'C', content: 'Jakarta', is_correct: true },
                { label: 'D', content: 'Medan', is_correct: false },
                { label: 'E', content: 'Nusantara', is_correct: false },
            ]
        },
        {
            content: 'Pancasila sebagai dasar negara Indonesia ditetapkan pada tanggal...',
            options: [
                { label: 'A', content: '17 Agustus 1945', is_correct: false },
                { label: 'B', content: '18 Agustus 1945', is_correct: true },
                { label: 'C', content: '1 Juni 1945', is_correct: false },
                { label: 'D', content: '22 Juni 1945', is_correct: false },
                { label: 'E', content: '20 Mei 1945', is_correct: false },
            ]
        },
        {
            content: 'Proses fotosintesis pada tumbuhan menghasilkan...',
            options: [
                { label: 'A', content: 'Karbon dioksida dan air', is_correct: false },
                { label: 'B', content: 'Glukosa dan oksigen', is_correct: true },
                { label: 'C', content: 'Nitrogen dan hidrogen', is_correct: false },
                { label: 'D', content: 'Protein dan lemak', is_correct: false },
                { label: 'E', content: 'Mineral dan vitamin', is_correct: false },
            ]
        },
        {
            content: 'Sinonim kata "antusias" adalah...',
            options: [
                { label: 'A', content: 'Malas', is_correct: false },
                { label: 'B', content: 'Bersemangat', is_correct: true },
                { label: 'C', content: 'Lesu', is_correct: false },
                { label: 'D', content: 'Acuh', is_correct: false },
                { label: 'E', content: 'Bingung', is_correct: false },
            ]
        },
        {
            content: 'Badan tertinggi Perserikatan Bangsa-Bangsa (PBB) adalah...',
            options: [
                { label: 'A', content: 'Dewan Keamanan', is_correct: false },
                { label: 'B', content: 'Sekretariat', is_correct: false },
                { label: 'C', content: 'Majelis Umum', is_correct: true },
                { label: 'D', content: 'Mahkamah Internasional', is_correct: false },
                { label: 'E', content: 'Dewan Ekonomi dan Sosial', is_correct: false },
            ]
        },
    ],
    PBM: [
        {
            content: 'Penulisan kata yang benar menurut EYD adalah...',
            options: [
                { label: 'A', content: 'di kamar', is_correct: true },
                { label: 'B', content: 'dikamar', is_correct: false },
                { label: 'C', content: 'Di kamar', is_correct: false },
                { label: 'D', content: 'diKamar', is_correct: false },
                { label: 'E', content: 'Di Kamar', is_correct: false },
            ]
        },
        {
            content: 'Kalimat yang menggunakan ejaan yang benar adalah...',
            options: [
                { label: 'A', content: 'Dia pergi ke-sekolah', is_correct: false },
                { label: 'B', content: 'Dia pergi kesekolah', is_correct: false },
                { label: 'C', content: 'Dia pergi ke sekolah', is_correct: true },
                { label: 'D', content: 'Dia pergi Ke sekolah', is_correct: false },
                { label: 'E', content: 'dia pergi ke sekolah', is_correct: false },
            ]
        },
        {
            content: 'Kata "mempermasalahkan" memiliki imbuhan...',
            options: [
                { label: 'A', content: 'me- dan -kan', is_correct: false },
                { label: 'B', content: 'memper- dan -kan', is_correct: true },
                { label: 'C', content: 'me- dan per-', is_correct: false },
                { label: 'D', content: 'per- dan -kan', is_correct: false },
                { label: 'E', content: 'mem- dan -kan', is_correct: false },
            ]
        },
        {
            content: 'Paragraf yang baik harus memiliki...',
            options: [
                { label: 'A', content: 'Kalimat utama dan kalimat penjelas', is_correct: true },
                { label: 'B', content: 'Hanya kalimat utama', is_correct: false },
                { label: 'C', content: 'Minimal 10 kalimat', is_correct: false },
                { label: 'D', content: 'Kalimat tanya dan jawaban', is_correct: false },
                { label: 'E', content: 'Tidak ada aturan khusus', is_correct: false },
            ]
        },
        {
            content: 'Antonim kata "dermawan" adalah...',
            options: [
                { label: 'A', content: 'Murah hati', is_correct: false },
                { label: 'B', content: 'Pemurah', is_correct: false },
                { label: 'C', content: 'Kikir', is_correct: true },
                { label: 'D', content: 'Baik hati', is_correct: false },
                { label: 'E', content: 'Budiman', is_correct: false },
            ]
        },
    ],
    PK: [
        {
            content: 'Nilai dari 3² + 4² = ...',
            options: [
                { label: 'A', content: '20', is_correct: false },
                { label: 'B', content: '25', is_correct: true },
                { label: 'C', content: '30', is_correct: false },
                { label: 'D', content: '49', is_correct: false },
                { label: 'E', content: '14', is_correct: false },
            ]
        },
        {
            content: 'Jika x + 3 = 10, maka nilai x adalah...',
            options: [
                { label: 'A', content: '5', is_correct: false },
                { label: 'B', content: '6', is_correct: false },
                { label: 'C', content: '7', is_correct: true },
                { label: 'D', content: '8', is_correct: false },
                { label: 'E', content: '13', is_correct: false },
            ]
        },
        {
            content: 'Sebuah persegi panjang memiliki panjang 8 cm dan lebar 5 cm. Luasnya adalah...',
            options: [
                { label: 'A', content: '26 cm²', is_correct: false },
                { label: 'B', content: '40 cm²', is_correct: true },
                { label: 'C', content: '13 cm²', is_correct: false },
                { label: 'D', content: '45 cm²', is_correct: false },
                { label: 'E', content: '80 cm²', is_correct: false },
            ]
        },
        {
            content: 'FPB dari 12 dan 18 adalah...',
            options: [
                { label: 'A', content: '3', is_correct: false },
                { label: 'B', content: '4', is_correct: false },
                { label: 'C', content: '6', is_correct: true },
                { label: 'D', content: '9', is_correct: false },
                { label: 'E', content: '36', is_correct: false },
            ]
        },
        {
            content: 'Persentase dari 25 terhadap 200 adalah...',
            options: [
                { label: 'A', content: '10%', is_correct: false },
                { label: 'B', content: '12.5%', is_correct: true },
                { label: 'C', content: '15%', is_correct: false },
                { label: 'D', content: '20%', is_correct: false },
                { label: 'E', content: '25%', is_correct: false },
            ]
        },
    ],
    PM: [
        {
            content: 'Jika f(x) = 2x + 5, maka f(3) = ...',
            options: [
                { label: 'A', content: '8', is_correct: false },
                { label: 'B', content: '10', is_correct: false },
                { label: 'C', content: '11', is_correct: true },
                { label: 'D', content: '13', is_correct: false },
                { label: 'E', content: '16', is_correct: false },
            ]
        },
        {
            content: 'Gradien garis yang melalui titik (0,3) dan (2,7) adalah...',
            options: [
                { label: 'A', content: '1', is_correct: false },
                { label: 'B', content: '2', is_correct: true },
                { label: 'C', content: '3', is_correct: false },
                { label: 'D', content: '4', is_correct: false },
                { label: 'E', content: '5', is_correct: false },
            ]
        },
        {
            content: 'Nilai dari log₂(32) = ...',
            options: [
                { label: 'A', content: '3', is_correct: false },
                { label: 'B', content: '4', is_correct: false },
                { label: 'C', content: '5', is_correct: true },
                { label: 'D', content: '6', is_correct: false },
                { label: 'E', content: '2', is_correct: false },
            ]
        },
        {
            content: 'Turunan dari f(x) = x³ adalah...',
            options: [
                { label: 'A', content: '2x', is_correct: false },
                { label: 'B', content: '3x', is_correct: false },
                { label: 'C', content: '3x²', is_correct: true },
                { label: 'D', content: 'x²', is_correct: false },
                { label: 'E', content: '4x³', is_correct: false },
            ]
        },
        {
            content: 'Jumlah dari deret aritmatika: 1 + 3 + 5 + 7 + 9 = ...',
            options: [
                { label: 'A', content: '20', is_correct: false },
                { label: 'B', content: '24', is_correct: false },
                { label: 'C', content: '25', is_correct: true },
                { label: 'D', content: '30', is_correct: false },
                { label: 'E', content: '15', is_correct: false },
            ]
        },
    ],
    LBI: [
        {
            content: 'Bacaan: "Para ilmuwan menemukan bahwa tidur yang cukup sangat penting untuk kesehatan otak." Ide pokok paragraf tersebut adalah...',
            options: [
                { label: 'A', content: 'Ilmuwan melakukan penelitian', is_correct: false },
                { label: 'B', content: 'Tidur cukup penting untuk kesehatan otak', is_correct: true },
                { label: 'C', content: 'Otak manusia sangat kompleks', is_correct: false },
                { label: 'D', content: 'Penelitian dilakukan bertahun-tahun', is_correct: false },
                { label: 'E', content: 'Kesehatan sangat mahal', is_correct: false },
            ]
        },
        {
            content: 'Kata "konservasi" dalam kalimat "Program konservasi hutan terus digalakkan pemerintah" bermakna...',
            options: [
                { label: 'A', content: 'Perusakan', is_correct: false },
                { label: 'B', content: 'Pembalakan', is_correct: false },
                { label: 'C', content: 'Pelestarian', is_correct: true },
                { label: 'D', content: 'Penebangan', is_correct: false },
                { label: 'E', content: 'Pembabatan', is_correct: false },
            ]
        },
        {
            content: 'Kalimat yang menggunakan majas metafora adalah...',
            options: [
                { label: 'A', content: 'Angin bertiup kencang sekali', is_correct: false },
                { label: 'B', content: 'Dia berlari secepat kilat', is_correct: false },
                { label: 'C', content: 'Dia adalah tulang punggung keluarga', is_correct: true },
                { label: 'D', content: 'Bunga-bunga bermekaran indah', is_correct: false },
                { label: 'E', content: 'Hujan turun deras sekali', is_correct: false },
            ]
        },
        {
            content: 'Teks yang bertujuan meyakinkan pembaca tentang suatu pendapat disebut teks...',
            options: [
                { label: 'A', content: 'Narasi', is_correct: false },
                { label: 'B', content: 'Deskripsi', is_correct: false },
                { label: 'C', content: 'Eksposisi', is_correct: false },
                { label: 'D', content: 'Argumentasi', is_correct: true },
                { label: 'E', content: 'Prosedur', is_correct: false },
            ]
        },
        {
            content: 'Penulisan daftar pustaka yang benar adalah...',
            options: [
                { label: 'A', content: 'Nama. Tahun. Judul. Kota: Penerbit', is_correct: true },
                { label: 'B', content: 'Judul. Nama. Tahun. Kota: Penerbit', is_correct: false },
                { label: 'C', content: 'Kota: Penerbit. Nama. Tahun. Judul', is_correct: false },
                { label: 'D', content: 'Tahun. Nama. Judul. Kota: Penerbit', is_correct: false },
                { label: 'E', content: 'Nama. Judul. Kota: Penerbit. Tahun', is_correct: false },
            ]
        },
    ],
    LBE: [
        {
            content: 'What is the meaning of "ambiguous"?',
            options: [
                { label: 'A', content: 'Clear and obvious', is_correct: false },
                { label: 'B', content: 'Having more than one possible meaning', is_correct: true },
                { label: 'C', content: 'Extremely large', is_correct: false },
                { label: 'D', content: 'Very small', is_correct: false },
                { label: 'E', content: 'Completely wrong', is_correct: false },
            ]
        },
        {
            content: 'Choose the correct sentence:',
            options: [
                { label: 'A', content: 'She don\'t like coffee', is_correct: false },
                { label: 'B', content: 'She doesn\'t likes coffee', is_correct: false },
                { label: 'C', content: 'She doesn\'t like coffee', is_correct: true },
                { label: 'D', content: 'She not like coffee', is_correct: false },
                { label: 'E', content: 'She no like coffee', is_correct: false },
            ]
        },
        {
            content: 'The word "resilient" is closest in meaning to:',
            options: [
                { label: 'A', content: 'Fragile', is_correct: false },
                { label: 'B', content: 'Weak', is_correct: false },
                { label: 'C', content: 'Able to recover quickly', is_correct: true },
                { label: 'D', content: 'Easily broken', is_correct: false },
                { label: 'E', content: 'Slow to adapt', is_correct: false },
            ]
        },
        {
            content: 'If I ___ more time, I would study harder. Choose the correct word:',
            options: [
                { label: 'A', content: 'have', is_correct: false },
                { label: 'B', content: 'has', is_correct: false },
                { label: 'C', content: 'had', is_correct: true },
                { label: 'D', content: 'having', is_correct: false },
                { label: 'E', content: 'will have', is_correct: false },
            ]
        },
        {
            content: 'Which word is an antonym of "diligent"?',
            options: [
                { label: 'A', content: 'Hardworking', is_correct: false },
                { label: 'B', content: 'Industrious', is_correct: false },
                { label: 'C', content: 'Lazy', is_correct: true },
                { label: 'D', content: 'Careful', is_correct: false },
                { label: 'E', content: 'Dedicated', is_correct: false },
            ]
        },
    ],
};

async function seed() {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        for (const subtes of SUBTES) {
            const soalList = SOAL[subtes.code];
            if (!soalList) continue;

            console.log(`\nSeeding ${subtes.code} - ${subtes.name}...`);

            const questionIds = [];

            // Insert soal + opsi + jawaban
            for (const soal of soalList) {
                const [qResult] = await conn.execute(
                    `INSERT INTO questions (category_id, type, content, difficulty, is_active)
                     VALUES (?, 'mcq_single', ?, 'medium', 1)`,
                    [subtes.category_id, soal.content]
                );
                const qId = qResult.insertId;
                questionIds.push(qId);

                const correctOptions = [];
                for (let i = 0; i < soal.options.length; i++) {
                    const opt = soal.options[i];
                    await conn.execute(
                        `INSERT INTO question_options (question_id, content, is_correct, sort_order)
                         VALUES (?, ?, ?, ?)`,
                        [qId, opt.content, opt.is_correct ? 1 : 0, i + 1]
                    );
                    if (opt.is_correct) correctOptions.push(i + 1);
                }

                // Simpan kunci jawaban sebagai answer_text (label opsi yang benar)
                const correctLabel = ['A','B','C','D','E'][soal.options.findIndex(o => o.is_correct)];
                await conn.execute(
                    `INSERT INTO question_answers (question_id, answer_text) VALUES (?, ?)`,
                    [qId, correctLabel]
                );
            }

            // Buat paket latihan untuk subtes ini
            const slug = `latihan-${subtes.code.toLowerCase()}-dasar`;
            const [paketResult] = await conn.execute(
                `INSERT INTO latihan_paket (category_id, name, slug, description, total_questions, duration_minutes, difficulty, is_active)
                 VALUES (?, ?, ?, ?, 5, 10, 'medium', 1)
                 ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
                [
                    subtes.category_id,
                    `Latihan ${subtes.name} - Dasar`,
                    slug,
                    `Paket latihan dasar untuk subtes ${subtes.name}. Berisi 5 soal pilihan ganda.`,
                ]
            );
            const paketId = paketResult.insertId;

            // Hapus soal lama jika ada (untuk idempoten)
            await conn.execute('DELETE FROM latihan_paket_questions WHERE paket_id = ?', [paketId]);

            // Hubungkan soal ke paket
            for (let i = 0; i < questionIds.length; i++) {
                await conn.execute(
                    `INSERT INTO latihan_paket_questions (paket_id, question_id, sort_order, marks)
                     VALUES (?, ?, ?, 1)`,
                    [paketId, questionIds[i], i + 1]
                );
            }

            // Update total_questions
            await conn.execute(
                'UPDATE latihan_paket SET total_questions = 5 WHERE id = ?',
                [paketId]
            );

            console.log(`  ✅ Paket ID ${paketId} — ${questionIds.length} soal ditambahkan`);
        }

        await conn.commit();
        console.log('\n✨ Seed selesai!');
    } catch (err) {
        await conn.rollback();
        console.error('❌ Error:', err.message);
        process.exit(1);
    } finally {
        conn.release();
        await pool.end();
    }
}

seed();
