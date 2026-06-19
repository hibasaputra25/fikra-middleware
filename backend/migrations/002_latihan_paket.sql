-- =====================================================================
-- MIGRATION 002: Paket Latihan
-- Menambahkan sistem paket latihan yang dibuat admin/guru
-- =====================================================================

-- Paket latihan (dibuat oleh admin/guru)
CREATE TABLE IF NOT EXISTS `latihan_paket` (
    `id`                INT AUTO_INCREMENT PRIMARY KEY,
    `category_id`       INT NULL,                    -- subtes/kategori induk
    `name`              VARCHAR(200) NOT NULL,        -- misal: "Latihan PBM #1"
    `slug`              VARCHAR(200) NOT NULL,
    `description`       TEXT NULL,
    `total_questions`   INT NOT NULL DEFAULT 0,      -- total soal dalam paket
    `duration_minutes`  INT NULL,                    -- NULL = tidak ada timer
    `difficulty`        ENUM('easy','medium','hard','mixed') NOT NULL DEFAULT 'mixed',
    `sort_order`        INT NOT NULL DEFAULT 0,
    `is_active`         TINYINT(1) NOT NULL DEFAULT 1,
    `created_by`        BIGINT NULL,                 -- moodle user_id admin
    `created_at`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY `uniq_slug` (`slug`),
    KEY `idx_category` (`category_id`),
    KEY `idx_active` (`is_active`),
    KEY `idx_sort` (`category_id`, `sort_order`),
    CONSTRAINT `fk_paket_category` FOREIGN KEY (`category_id`)
        REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Soal dalam paket latihan (urutan soal ditentukan admin)
CREATE TABLE IF NOT EXISTS `latihan_paket_questions` (
    `id`          INT AUTO_INCREMENT PRIMARY KEY,
    `paket_id`    INT NOT NULL,
    `question_id` INT NOT NULL,
    `sort_order`  INT NOT NULL DEFAULT 0,
    `marks`       DECIMAL(8,2) NOT NULL DEFAULT 1.00,

    UNIQUE KEY `uniq_paket_question` (`paket_id`, `question_id`),
    KEY `idx_question` (`question_id`),
    CONSTRAINT `fk_lpq_paket` FOREIGN KEY (`paket_id`)
        REFERENCES `latihan_paket` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_lpq_question` FOREIGN KEY (`question_id`)
        REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Sesi pengerjaan latihan siswa (satu row per attempt)
CREATE TABLE IF NOT EXISTS `latihan_attempts` (
    `id`                  INT AUTO_INCREMENT PRIMARY KEY,
    `paket_id`            INT NOT NULL,
    `user_id`             BIGINT NOT NULL,
    `status`              ENUM('in_progress','submitted','abandoned')
                          NOT NULL DEFAULT 'in_progress',
    `started_at`          DATETIME NOT NULL,
    `finished_at`         DATETIME NULL,
    `time_spent_seconds`  INT NOT NULL DEFAULT 0,
    `total_correct`       INT NOT NULL DEFAULT 0,
    `total_wrong`         INT NOT NULL DEFAULT 0,
    `total_score`         DECIMAL(10,2) NULL,        -- persentase 0-100
    `created_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY `idx_paket_user` (`paket_id`, `user_id`),
    KEY `idx_user` (`user_id`),
    KEY `idx_status` (`status`),
    CONSTRAINT `fk_la_paket` FOREIGN KEY (`paket_id`)
        REFERENCES `latihan_paket` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Jawaban siswa per soal dalam latihan
CREATE TABLE IF NOT EXISTS `latihan_attempt_answers` (
    `id`                   INT AUTO_INCREMENT PRIMARY KEY,
    `attempt_id`           INT NOT NULL,
    `question_id`          INT NOT NULL,
    `selected_option_ids`  JSON NULL,               -- array of option id
    `answer_text`          TEXT NULL,               -- untuk essay/short answer
    `is_correct`           TINYINT(1) NULL,
    `is_flagged`           TINYINT(1) NOT NULL DEFAULT 0,
    `marks_earned`         DECIMAL(8,2) NULL,
    `answered_at`          TIMESTAMP NULL,

    UNIQUE KEY `uniq_attempt_question` (`attempt_id`, `question_id`),
    KEY `idx_attempt` (`attempt_id`),
    KEY `idx_question` (`question_id`),
    CONSTRAINT `fk_laa_attempt` FOREIGN KEY (`attempt_id`)
        REFERENCES `latihan_attempts` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_laa_question` FOREIGN KEY (`question_id`)
        REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
