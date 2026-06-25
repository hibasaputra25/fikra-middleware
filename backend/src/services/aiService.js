const Groq = require('groq-sdk');

// Lazy init — hindari error saat module di-load tanpa env
let _groq = null;
function getGroq() {
    if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    return _groq;
}
const MODEL = 'llama-3.3-70b-versatile';

// Buat system prompt dinamis berdasarkan data siswa
function buildSystemPrompt(namaSiswa, nilaiPerSubtes) {
    const subtesLemah = Object.entries(nilaiPerSubtes)
        .filter(([_, v]) => v.skor < 600)
        .sort((a, b) => a[1].skor - b[1].skor)
        .map(([k, v]) => `${k} (${v.label}): ${v.skor}`);

    const subtesKuat = Object.entries(nilaiPerSubtes)
        .filter(([_, v]) => v.skor >= 700)
        .sort((a, b) => b[1].skor - a[1].skor)
        .map(([k, v]) => `${k} (${v.label}): ${v.skor}`);

    const ringkasanSkor = Object.entries(nilaiPerSubtes)
        .map(([k, v]) => `- ${k} (${v.label}): ${v.skor}/1000 (${v.benar}/${v.total} benar)`)
        .join('\n');

    return `Kamu adalah Kak Fikra, AI Tutor dari Fikra Academy — bimbingan belajar persiapan SNBT/UTBK dengan misi sosial.

Kamu sedang membantu siswa bernama ${namaSiswa}.

Data performa tryout terakhir ${namaSiswa}:
${ringkasanSkor}

${subtesLemah.length > 0 ? `Subtes yang perlu ditingkatkan: ${subtesLemah.join(', ')}` : 'Semua subtes sudah di atas rata-rata!'}
${subtesKuat.length > 0 ? `Subtes terkuat: ${subtesKuat.join(', ')}` : ''}

Panduan menjawab:
- Selalu kaitkan jawaban dengan kondisi performa siswa di atas
- Jangan keluar dari konteks persiapan SNBT/UTBK
- Gunakan bahasa yang ramah, memotivasi, dan mudah dipahami
- Berikan saran belajar yang spesifik dan actionable
- Boleh sedikit menggunakan bahasa gen-z tapi tetap sopan dan profesional
- Jika ditanya soal materi, jelaskan dengan contoh yang relevan dengan SNBT
- Maksimal 3 paragraf per jawaban kecuali diminta lebih detail`;
}

// Chat dengan Kak Fikra
async function chat(messages, namaSiswa, nilaiPerSubtes) {
    const systemPrompt = buildSystemPrompt(namaSiswa, nilaiPerSubtes);

    const completion = await getGroq().chat.completions.create({
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages
        ],
        model: MODEL,
        temperature: 0.7,
        max_tokens: 1024
    });

    return completion.choices[0].message.content;
}

// Generate analisis otomatis post-tryout
async function generateAnalisis(namaSiswa, nilaiPerSubtes, quizNama) {
    const ringkasan = Object.entries(nilaiPerSubtes)
        .map(([k, v]) => `${k}: ${v.benar}/${v.total} (skor ${v.skor})`)
        .join(', ');

    const subtesTerendah = Object.entries(nilaiPerSubtes)
        .sort((a, b) => a[1].skor - b[1].skor)[0];

    const prompt = `Buat analisis singkat hasil ${quizNama} untuk siswa bernama ${namaSiswa}.

Hasil per subtes: ${ringkasan}

Subtes terendah: ${subtesTerendah[0]} (${subtesTerendah[1].label}) dengan skor ${subtesTerendah[1].skor}/1000.

Berikan:
1. 2 kalimat penyemangat yang energik dan memotivasi
2. 1 analisis singkat kekuatan siswa
3. 1 saran belajar spesifik untuk subtes terendah

Gunakan gaya bahasa pelatih yang tegas, penuh energi, sedikit gen-z tapi tetap sopan.`;

    const completion = await getGroq().chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: MODEL,
        temperature: 0.7,
        max_tokens: 512
    });

    return completion.choices[0].message.content;
}

module.exports = { chat, generateAnalisis, buildSystemPrompt };