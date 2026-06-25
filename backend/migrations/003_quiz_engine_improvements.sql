-- =====================================================================
-- MIGRATION 003: Quiz Engine Improvements
-- 1. latihan_paket   — tambah shuffle_questions, shuffle_options
-- 2. latihan_attempts — tambah due_at
-- 3. latihan_attempt_questions — urutan soal per-attempt (untuk shuffle)
-- 4. latihan_attempt_answers  — tambah sequence_token
-- =====================================================================

-- 1. Kolom shuffle di latihan_paket
ALTER TABLE `latihan_paket`
    ADD COLUMN `shuffle_questions` TINYINT(1) NOT NULL DEFAULT 0
        AFTER `duration_minutes`,
    ADD COLUMN `shuffle_options`   TINYINT(1) NOT NULL DEFAULT 0
        AFTER `shuffle_questions`;

-- 2. due_at di latihan_attempts (server-side deadline)
ALTER TABLE `latihan_attempts`
    ADD COLUMN `due_at` DATETIME NULL
        AFTER `started_at`;

-- 3. Urutan soal per-attempt (di-generate saat startAttempt, mendukung shuffle)
--    Satu row per (attempt, question). sort_order menentukan urutan tampil.
CREATE TABLE IF NOT EXISTS `latihan_attempt_questions` (
    `id`           INT AUTO_INCREMENT PRIMARY KEY,
    `attempt_id`   INT NOT NULL,
    `question_id`  INT NOT NULL,
    `sort_order`   INT NOT NULL DEFAULT 0,

    UNIQUE KEY `uniq_attempt_question` (`attempt_id`, `question_id`),
    KEY `idx_attempt` (`attempt_id`),
    CONSTRAINT `fk_laq_attempt` FOREIGN KEY (`attempt_id`)
        REFERENCES `latihan_attempts` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_laq_question` FOREIGN KEY (`question_id`)
        REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. sequence_token dan option_order di latihan_attempt_answers
--    sequence_token: token unik per soal per attempt untuk anti-replay
--    option_order:   urutan opsi yang di-shuffle (JSON array of option id)
ALTER TABLE `latihan_attempt_answers`
    ADD COLUMN `sequence_token` VARCHAR(64) NULL
        AFTER `answered_at`,
    ADD COLUMN `option_order`   JSON NULL
        AFTER `sequence_token`;
