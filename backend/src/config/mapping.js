const path = require('path');
const mappingData = require(path.join(__dirname, '..', '..', '..', 'mapping.json'));

/**
 * Hitung nilai per subtes dari array questions Moodle
 * @param {Array} questions - Array dari mod_quiz_get_attempt_review
 * @param {number} quizId - ID quiz
 * @returns {Object} hasil per subtes
 */
function hitungNilaiPerSubtes(questions, quizId) {
    const quizMapping = mappingData.quiz[String(quizId)];
    if (!quizMapping) {
        throw new Error(`Tidak ada mapping untuk quiz ID ${quizId}`);
    }

    // Hitung nomor soal aktif
    let noSoal = 0;
    const soalAktif = [];

    for (const q of questions) {
        const maxmark = parseFloat(q.maxmark) || 0;
        if (maxmark > 0) {
            noSoal++;
            soalAktif.push({
                noSoal,
                slot: q.slot,
                mark: parseFloat(q.mark) || 0,
                maxmark,
                state: q.state
            });
        }
    }

    // Hitung per subtes
    const hasil = {};
    let totalBenar = 0;
    let totalSoal = 0;

    for (const [kode, range] of Object.entries(quizMapping.subtes)) {
        const soalSubtes = soalAktif.filter(
            s => s.noSoal >= range.noSoal_start && s.noSoal <= range.noSoal_end
        );

        const benar = soalSubtes.filter(s => s.state === 'gradedright').length;
        const salah = soalSubtes.filter(s => s.state === 'gradedwrong').length;
        const total = soalSubtes.length;
        const skor = total > 0 ? Math.round((benar / total) * 1000) : 0;

        hasil[kode] = {
            label: range.label,
            benar,
            salah,
            total,
            skor
        };

        totalBenar += benar;
        totalSoal += total;
    }

    return {
        per_subtes: hasil,
        total: {
            benar: totalBenar,
            total: totalSoal,
            skor: totalSoal > 0 ? Math.round((totalBenar / totalSoal) * 1000) : 0
        },
        quiz_info: {
            nama: quizMapping.nama,
            tipe: quizMapping.tipe,
            total_soal: quizMapping.total_soal
        }
    };
}

function getMappingByQuizId(quizId) {
    return mappingData.quiz[String(quizId)] || null;
}

module.exports = { hitungNilaiPerSubtes, getMappingByQuizId, mappingData };