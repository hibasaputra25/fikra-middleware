-- =====================================================================
-- MIGRATION 003 — Question Collections
-- =====================================================================
-- Berbeda dari `categories` (subtes/topik/subtopik = struktur akademik),
-- collections adalah pengelompokan bebas yang dibuat admin/guru,
-- mirip "Quiz module" / "Question bank category" di Moodle.
--
-- Contoh: "Tryout Juni 2026", "Latihan Mingguan Bab 3", "Soal Bocoran SBMPTN".
-- Satu soal bisa berada di beberapa collection sekaligus.
-- =====================================================================

CREATE TABLE IF NOT EXISTS `question_collections` (
    `id`           INT AUTO_INCREMENT PRIMARY KEY,
    `name`         VARCHAR(150) NOT NULL,
    `slug`         VARCHAR(150) NOT NULL,
    `description`  TEXT NULL,
    `color`        VARCHAR(20) NULL,
    `parent_id`    INT NULL,                       -- support nesting (opsional)
    `sort_order`   INT NOT NULL DEFAULT 0,
    `created_by`   BIGINT NULL,                    -- moodle userid
    `is_active`    TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY `uniq_collection_slug` (`slug`),
    KEY `idx_collection_parent` (`parent_id`),
    KEY `idx_collection_active` (`is_active`),
    CONSTRAINT `fk_collection_parent` FOREIGN KEY (`parent_id`)
        REFERENCES `question_collections` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `question_collection_items` (
    `collection_id` INT NOT NULL,
    `question_id`   INT NOT NULL,
    `sort_order`    INT NOT NULL DEFAULT 0,
    `added_by`      BIGINT NULL,
    `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`collection_id`, `question_id`),
    KEY `idx_qci_question` (`question_id`),
    CONSTRAINT `fk_qci_collection` FOREIGN KEY (`collection_id`)
        REFERENCES `question_collections` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_qci_question` FOREIGN KEY (`question_id`)
        REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
