const crypto = require('crypto');

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function generateSequenceToken(attemptId, questionId) {
    return crypto
        .createHmac('sha256', process.env.APP_SECRET || 'fikra-quiz-secret')
        .update(`${attemptId}:${questionId}`)
        .digest('hex')
        .slice(0, 32);
}

function generateSlug(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim() + '-' + Date.now();
}

function gradeShortAnswer(studentAnswer, keys) {
    if (!studentAnswer || keys.length === 0) return false;
    const text = String(studentAnswer).trim();
    return keys.some(key => {
        const expected = String(key.answer_text || '').trim();
        switch (key.match_type) {
            case 'exact':             return text === expected;
            case 'case_insensitive':  return text.toLowerCase() === expected.toLowerCase();
            case 'contains':          return text.toLowerCase().includes(expected.toLowerCase());
            case 'regex': {
                try { return new RegExp(expected, 'i').test(text); }
                catch { return false; }
            }
            default: return text.toLowerCase() === expected.toLowerCase();
        }
    });
}

function gradeNumeric(studentAnswer, keys) {
    if (!studentAnswer || keys.length === 0) return false;
    const num = parseFloat(String(studentAnswer).replace(',', '.'));
    if (isNaN(num)) return false;
    return keys.some(key => {
        const expected  = parseFloat(key.numeric_value);
        const tolerance = parseFloat(key.numeric_tolerance || 0);
        return Math.abs(num - expected) <= tolerance;
    });
}

module.exports = { shuffleArray, generateSequenceToken, generateSlug, gradeShortAnswer, gradeNumeric };
