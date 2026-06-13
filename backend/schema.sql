-- =====================================================================
-- FIKRA ACADEMY — QUIZ ENGINE SCHEMA
-- =====================================================================
-- Modul:
--   1. Categories       — hierarki Subtes → Topik → Sub-topik
--   2. Question Bank    — soal, opsi, jawaban, gambar
--   3. Tryouts          — paket tryout terstruktur (SNBT-like)
--   4. Latihan          — sesi latihan bebas per topik
--   5. Legacy           — tabel lama (tetap untuk import dari Moodle)
-- =====================================================================
-- User reference: kolom `user_id` mengacu ke Moodle userid (BIGINT).
-- Tidak ada FK karena tabel users belum di-migrate.
-- =====================================================================


-- =====================================================================
-- 1. CATEGORIES (hierarchical)
-- =====================================================================
-- level: subtes (root) → topik → subtopik
-- Contoh:
--   PM (subtes) → Aljabar (topik) → Persamaan Linear (subtopik)
-- =====================================================================

CREATE TABLE IF NOT EXISTS `categories` (
    `id`          INT AUTO_INCREMENT PRIMARY KEY,
    `parent_id`   INT NULL,
    `code`        VARCHAR(20) NULL,
    `name`        VARCHAR(150) NOT NULL,
    `slug`        VARCHAR(150) NOT NULL,
    `level`       ENUM('subtes', 'topik', 'subtopik') NOT NULL,
    `description` TEXT NULL,
    `sort_order`  INT NOT NULL DEFAULT 0,
    `is_active`   TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY `uniq_slug` (`slug`),
    KEY `idx_parent` (`parent_id`),
    KEY `idx_level` (`level`),
    CONSTRAINT `fk_category_parent` FOREIGN KEY (`parent_id`)
        REFERENCES `categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 2. QUESTION BANK
-- =====================================================================

CREATE TABLE IF NOT EXISTS `questions` (
    `id`            INT AUTO_INCREMENT PRIMARY KEY,
    `category_id`   INT NULL,
    `type`          ENUM(
                        'mcq_single',   -- pilihan ganda 1 jawaban
                        'mcq_multi',    -- pilihan ganda multi jawaban
                        'true_false',
                        'short_answer', -- isian singkat (auto-grade)
                        'essay',        -- esai (manual grade)
                        'numeric'       -- angka dengan toleransi
                    ) NOT NULL,
    `content`       LONGTEXT NOT NULL,         -- HTML/LaTeX-ready
    `explanation`   LONGTEXT NULL,             -- pembahasan
    `difficulty`    ENUM('easy','medium','hard') NOT NULL DEFAULT 'medium',
    `default_marks` DECIMAL(8,2) NOT NULL DEFAULT 1.00,
    `penalty`       DECIMAL(8,2) NOT NULL DEFAULT 0.00,  -- skor dikurangi jika salah
    `created_by`    BIGINT NULL,               -- moodle user_id
    `is_active`     TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY `idx_category` (`category_id`),
    KEY `idx_type` (`type`),
    KEY `idx_difficulty` (`difficulty`),
    KEY `idx_active` (`is_active`),
    CONSTRAINT `fk_question_category` FOREIGN KEY (`category_id`)
        REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Pilihan jawaban — untuk mcq_single, mcq_multi, true_false
CREATE TABLE IF NOT EXISTS `question_options` (
    `id`          INT AUTO_INCREMENT PRIMARY KEY,
    `question_id` INT NOT NULL,
    `content`     TEXT NOT NULL,
    `is_correct`  TINYINT(1) NOT NULL DEFAULT 0,
    `sort_order`  INT NOT NULL DEFAULT 0,

    KEY `idx_question` (`question_id`),
    CONSTRAINT `fk_option_question` FOREIGN KEY (`question_id`)
        REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Kunci jawaban — untuk short_answer & numeric (auto-grade)
-- Satu soal bisa punya beberapa jawaban yang dianggap benar.
CREATE TABLE IF NOT EXISTS `question_answers` (
    `id`                INT AUTO_INCREMENT PRIMARY KEY,
    `question_id`       INT NOT NULL,
    `answer_text`       VARCHAR(500) NULL,        -- untuk short_answer
    `numeric_value`     DECIMAL(20,6) NULL,       -- untuk numeric
    `numeric_tolerance` DECIMAL(20,6) NULL,       -- ± tolerance
    `match_type`        ENUM('exact','case_insensitive','contains','regex')
                        NOT NULL DEFAULT 'case_insensitive',

    KEY `idx_question` (`question_id`),
    CONSTRAINT `fk_answer_question` FOREIGN KEY (`question_id`)
        REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Lampiran gambar pada soal/opsi
CREATE TABLE IF NOT EXISTS `question_images` (
    `id`          INT AUTO_INCREMENT PRIMARY KEY,
    `question_id` INT NOT NULL,
    `option_id`   INT NULL,                      -- jika gambar di opsi
    `url`         VARCHAR(500) NOT NULL,
    `alt_text`    VARCHAR(255) NULL,
    `position`    ENUM('question','option','explanation') NOT NULL DEFAULT 'question',
    `sort_order`  INT NOT NULL DEFAULT 0,

    KEY `idx_question` (`question_id`),
    KEY `idx_option` (`option_id`),
    CONSTRAINT `fk_image_question` FOREIGN KEY (`question_id`)
        REFERENCES `questions` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_image_option` FOREIGN KEY (`option_id`)
        REFERENCES `question_options` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 3. TRYOUTS (paket terstruktur SNBT-like, terjadwal)
-- =====================================================================

CREATE TABLE IF NOT EXISTS `tryouts` (
    `id`                INT AUTO_INCREMENT PRIMARY KEY,
    `name`              VARCHAR(200) NOT NULL,
    `description`       TEXT NULL,
    `type`              ENUM('snbt_full','snbt_subtes','custom') NOT NULL DEFAULT 'custom',
    `duration_minutes`  INT NULL,                 -- NULL = pakai per-section
    `start_at`          DATETIME NULL,            -- jadwal buka
    `end_at`            DATETIME NULL,            -- jadwal tutup
    `max_attempts`      INT NOT NULL DEFAULT 1,
    `shuffle_questions` TINYINT(1) NOT NULL DEFAULT 0,
    `shuffle_options`   TINYINT(1) NOT NULL DEFAULT 0,
    `show_review`       TINYINT(1) NOT NULL DEFAULT 1,    -- boleh review setelah submit
    `show_explanation`  TINYINT(1) NOT NULL DEFAULT 1,    -- tampilkan pembahasan
    `passing_score`     DECIMAL(8,2) NULL,
    `status`            ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
    `created_by`        BIGINT NULL,
    `created_at`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY `idx_status` (`status`),
    KEY `idx_schedule` (`start_at`, `end_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Section di dalam tryout (mis. PBM, PPU, PK, PM, PU, LBI, LBE)
CREATE TABLE IF NOT EXISTS `tryout_sections` (
    `id`               INT AUTO_INCREMENT PRIMARY KEY,
    `tryout_id`        INT NOT NULL,
    `category_id`      INT NULL,                  -- subtes mana
    `name`             VARCHAR(150) NOT NULL,
    `sort_order`       INT NOT NULL DEFAULT 0,
    `duration_minutes` INT NULL,
    `total_questions`  INT NOT NULL DEFAULT 0,

    KEY `idx_tryout` (`tryout_id`),
    KEY `idx_category` (`category_id`),
    CONSTRAINT `fk_section_tryout` FOREIGN KEY (`tryout_id`)
        REFERENCES `tryouts` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_section_category` FOREIGN KEY (`category_id`)
        REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Mapping soal ke section
CREATE TABLE IF NOT EXISTS `tryout_section_questions` (
    `id`          INT AUTO_INCREMENT PRIMARY KEY,
    `section_id`  INT NOT NULL,
    `question_id` INT NOT NULL,
    `sort_order`  INT NOT NULL DEFAULT 0,
    `marks`       DECIMAL(8,2) NOT NULL DEFAULT 1.00,
    `penalty`     DECIMAL(8,2) NOT NULL DEFAULT 0.00,

    UNIQUE KEY `uniq_section_question` (`section_id`, `question_id`),
    KEY `idx_question` (`question_id`),
    CONSTRAINT `fk_sq_section` FOREIGN KEY (`section_id`)
        REFERENCES `tryout_sections` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_sq_question` FOREIGN KEY (`question_id`)
        REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Sesi pengerjaan tryout siswa
CREATE TABLE IF NOT EXISTS `tryout_attempts` (
    `id`                  INT AUTO_INCREMENT PRIMARY KEY,
    `tryout_id`           INT NOT NULL,
    `user_id`             BIGINT NOT NULL,        -- moodle userid
    `attempt_number`      INT NOT NULL DEFAULT 1,
    `status`              ENUM('in_progress','submitted','expired','abandoned')
                          NOT NULL DEFAULT 'in_progress',
    `started_at`          DATETIME NOT NULL,
    `due_at`              DATETIME NULL,          -- batas waktu (server-side enforcement)
    `finished_at`         DATETIME NULL,
    `time_spent_seconds`  INT NOT NULL DEFAULT 0,
    `total_score`         DECIMAL(10,2) NULL,     -- total mentah
    `score_per_section`   JSON NULL,              -- {section_id: {benar, total, skor}}
    `score_irt`           JSON NULL,              -- {subtes: 0..1000}
    `ai_insight`          LONGTEXT NULL,
    `created_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY `uniq_tryout_user_attempt` (`tryout_id`, `user_id`, `attempt_number`),
    KEY `idx_user` (`user_id`),
    KEY `idx_status` (`status`),
    KEY `idx_tryout_user` (`tryout_id`, `user_id`),
    CONSTRAINT `fk_attempt_tryout` FOREIGN KEY (`tryout_id`)
        REFERENCES `tryouts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Jawaban siswa per soal (auto-save target)
-- Satu row per (attempt, question). Update saat siswa ganti jawaban.
CREATE TABLE IF NOT EXISTS `tryout_attempt_answers` (
    `id`                   INT AUTO_INCREMENT PRIMARY KEY,
    `attempt_id`           INT NOT NULL,
    `section_id`           INT NOT NULL,
    `question_id`          INT NOT NULL,
    `answer`               JSON NULL,             -- {selected_options:[], text:"", numeric:0}
    `is_correct`           TINYINT(1) NULL,       -- NULL = belum dinilai (esai)
    `is_partially_correct` TINYINT(1) NOT NULL DEFAULT 0,
    `marks_earned`         DECIMAL(8,2) NULL,
    `is_flagged`           TINYINT(1) NOT NULL DEFAULT 0,  -- ragu
    `time_spent_seconds`   INT NOT NULL DEFAULT 0,
    `answered_at`          TIMESTAMP NULL,
    `graded_at`            TIMESTAMP NULL,
    `graded_by`            BIGINT NULL,           -- untuk esai

    UNIQUE KEY `uniq_attempt_question` (`attempt_id`, `question_id`),
    KEY `idx_attempt` (`attempt_id`),
    KEY `idx_question` (`question_id`),
    CONSTRAINT `fk_taa_attempt` FOREIGN KEY (`attempt_id`)
        REFERENCES `tryout_attempts` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_taa_section` FOREIGN KEY (`section_id`)
        REFERENCES `tryout_sections` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_taa_question` FOREIGN KEY (`question_id`)
        REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 4. LATIHAN (sesi latihan bebas, per topik / acak)
-- =====================================================================

CREATE TABLE IF NOT EXISTS `latihan_sessions` (
    `id`                 INT AUTO_INCREMENT PRIMARY KEY,
    `user_id`            BIGINT NOT NULL,
    `category_id`        INT NULL,                -- topik/subtopik yang dilatih
    `source_type`        ENUM(
                            'random',             -- acak dari kategori
                            'topic',              -- spesifik topik
                            'recommended',        -- dari rekomendasi AI
                            'wrong_answers',      -- ulangi soal yang salah
                            'difficulty'          -- by tingkat kesulitan
                         ) NOT NULL DEFAULT 'topic',
    `difficulty_filter`  ENUM('easy','medium','hard','mixed') NOT NULL DEFAULT 'mixed',
    `total_questions`    INT NOT NULL DEFAULT 0,
    `total_marks`        DECIMAL(10,2) NULL,
    `score`              DECIMAL(10,2) NULL,
    `status`             ENUM('in_progress','submitted','abandoned')
                         NOT NULL DEFAULT 'in_progress',
    `started_at`         DATETIME NOT NULL,
    `finished_at`        DATETIME NULL,
    `time_spent_seconds` INT NOT NULL DEFAULT 0,
    `created_at`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY `idx_user` (`user_id`),
    KEY `idx_category` (`category_id`),
    KEY `idx_status` (`status`),
    CONSTRAINT `fk_latihan_category` FOREIGN KEY (`category_id`)
        REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Daftar soal yang muncul dalam sesi latihan
CREATE TABLE IF NOT EXISTS `latihan_session_questions` (
    `id`          INT AUTO_INCREMENT PRIMARY KEY,
    `session_id`  INT NOT NULL,
    `question_id` INT NOT NULL,
    `sort_order`  INT NOT NULL DEFAULT 0,
    `marks`       DECIMAL(8,2) NOT NULL DEFAULT 1.00,

    UNIQUE KEY `uniq_session_question` (`session_id`, `question_id`),
    KEY `idx_question` (`question_id`),
    CONSTRAINT `fk_lsq_session` FOREIGN KEY (`session_id`)
        REFERENCES `latihan_sessions` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_lsq_question` FOREIGN KEY (`question_id`)
        REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Jawaban siswa di sesi latihan
CREATE TABLE IF NOT EXISTS `latihan_answers` (
    `id`                   INT AUTO_INCREMENT PRIMARY KEY,
    `session_id`           INT NOT NULL,
    `question_id`          INT NOT NULL,
    `answer`               JSON NULL,
    `is_correct`           TINYINT(1) NULL,
    `is_partially_correct` TINYINT(1) NOT NULL DEFAULT 0,
    `marks_earned`         DECIMAL(8,2) NULL,
    `is_flagged`           TINYINT(1) NOT NULL DEFAULT 0,
    `time_spent_seconds`   INT NOT NULL DEFAULT 0,
    `answered_at`          TIMESTAMP NULL,

    UNIQUE KEY `uniq_session_question` (`session_id`, `question_id`),
    KEY `idx_session` (`session_id`),
    KEY `idx_question` (`question_id`),
    CONSTRAINT `fk_la_session` FOREIGN KEY (`session_id`)
        REFERENCES `latihan_sessions` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_la_question` FOREIGN KEY (`question_id`)
        REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 5. LEGACY (existing — untuk hasil tryout dari Moodle)
-- =====================================================================

CREATE TABLE IF NOT EXISTS `tryout_results` (
    `id`             INT AUTO_INCREMENT PRIMARY KEY,
    `attempt_id`     INT NOT NULL,
    `user_id`        INT NOT NULL,
    `quiz_id`        INT NOT NULL,
    `nama_siswa`     VARCHAR(100) NOT NULL,
    `nama_tryout`    VARCHAR(100) NOT NULL,
    `waktu_selesai`  DATETIME NOT NULL,
    `skor_subtes`    LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL
                     CHECK (json_valid(`skor_subtes`)),
    `analisis_soal`  LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL
                     CHECK (json_valid(`analisis_soal`)),
    `ai_insight`     LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
    `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY `attempt_id` (`attempt_id`),
    KEY `idx_user` (`user_id`),
    KEY `idx_quiz` (`quiz_id`),
    KEY `idx_user_quiz` (`user_id`, `quiz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `chat_history` (
    `id`         INT AUTO_INCREMENT PRIMARY KEY,
    `user_id`    INT NOT NULL,
    `quiz_id`    INT DEFAULT NULL,
    `role`       ENUM('user','assistant') NOT NULL,
    `content`    TEXT NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY `idx_user_chat` (`user_id`),
    KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- SEED DATA — Subtes SNBT
-- =====================================================================

INSERT IGNORE INTO `categories` (`code`, `name`, `slug`, `level`, `sort_order`) VALUES
    ('PBM', 'Penalaran Umum',                   'pbm', 'subtes', 1),
    ('PPU', 'Pengetahuan dan Pemahaman Umum',   'ppu', 'subtes', 2),
    ('PK',  'Pemahaman Bacaan dan Menulis',     'pk',  'subtes', 3),
    ('PM',  'Pengetahuan Kuantitatif',          'pm',  'subtes', 4),
    ('PU',  'Penalaran Matematika',             'pu',  'subtes', 5),
    ('LBI', 'Literasi Bahasa Indonesia',        'lbi', 'subtes', 6),
    ('LBE', 'Literasi Bahasa Inggris',          'lbe', 'subtes', 7);
