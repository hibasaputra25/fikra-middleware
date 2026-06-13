-- =====================================================================
-- MIGRATION 002 — Rich Question Features
-- Idempotent: error "duplicate column/key/table" akan di-skip oleh migrator
-- =====================================================================

-- 1. Kolom tambahan di tabel questions
ALTER TABLE `questions`
    ADD COLUMN `shuffle_options`  TINYINT(1)   NOT NULL DEFAULT 0  AFTER `penalty`;

ALTER TABLE `questions`
    ADD COLUMN `try_penalty`      DECIMAL(5,4) NOT NULL DEFAULT 0  AFTER `shuffle_options`;

ALTER TABLE `questions`
    ADD COLUMN `general_feedback` LONGTEXT     NULL                AFTER `explanation`;


-- 2. Feedback per opsi
ALTER TABLE `question_options`
    ADD COLUMN `feedback` TEXT NULL AFTER `is_correct`;


-- 3. Tags master + junction
CREATE TABLE IF NOT EXISTS `tags` (
    `id`          INT AUTO_INCREMENT PRIMARY KEY,
    `name`        VARCHAR(100) NOT NULL,
    `slug`        VARCHAR(100) NOT NULL,
    `color`       VARCHAR(20) NULL,
    `usage_count` INT NOT NULL DEFAULT 0,
    `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY `uniq_tag_slug` (`slug`),
    KEY `idx_tag_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `question_tags` (
    `question_id` INT NOT NULL,
    `tag_id`      INT NOT NULL,
    `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`question_id`, `tag_id`),
    KEY `idx_qt_tag` (`tag_id`),
    CONSTRAINT `fk_qt_question` FOREIGN KEY (`question_id`)
        REFERENCES `questions` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_qt_tag` FOREIGN KEY (`tag_id`)
        REFERENCES `tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 4. Hints (bantuan bertahap)
CREATE TABLE IF NOT EXISTS `question_hints` (
    `id`               INT AUTO_INCREMENT PRIMARY KEY,
    `question_id`      INT NOT NULL,
    `content`          TEXT NOT NULL,
    `sort_order`       INT NOT NULL DEFAULT 0,
    `clear_wrong`      TINYINT(1) NOT NULL DEFAULT 0,
    `show_num_correct` TINYINT(1) NOT NULL DEFAULT 0,

    KEY `idx_qh_question` (`question_id`),
    CONSTRAINT `fk_qh_question` FOREIGN KEY (`question_id`)
        REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 5. Versioning soal
CREATE TABLE IF NOT EXISTS `question_revisions` (
    `id`              INT AUTO_INCREMENT PRIMARY KEY,
    `question_id`     INT NOT NULL,
    `revision_number` INT NOT NULL,
    `snapshot`        JSON NOT NULL,
    `change_note`     VARCHAR(500) NULL,
    `changed_by`      BIGINT NULL,
    `created_at`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY `uniq_question_revision` (`question_id`, `revision_number`),
    KEY `idx_qr_question` (`question_id`),
    KEY `idx_qr_created` (`created_at`),
    CONSTRAINT `fk_qr_question` FOREIGN KEY (`question_id`)
        REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
