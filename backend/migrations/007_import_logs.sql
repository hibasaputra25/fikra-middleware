-- =====================================================================
-- MIGRATION 007: Import Logs
-- Tracking riwayat import soal
-- =====================================================================

CREATE TABLE IF NOT EXISTS `import_logs` (
    `id`              INT AUTO_INCREMENT PRIMARY KEY,
    `filename`        VARCHAR(255) NOT NULL,
    `format`          ENUM('moodle_xml','csv','gift') NOT NULL,
    `status`          ENUM('success','partial','failed') NOT NULL,
    `total_parsed`    INT NOT NULL DEFAULT 0,
    `total_inserted`  INT NOT NULL DEFAULT 0,
    `total_skipped`   INT NOT NULL DEFAULT 0,
    `total_errors`    INT NOT NULL DEFAULT 0,
    `category_id`     INT NULL,           -- target kategori (jika di-override)
    `errors`          JSON NULL,           -- array of error messages
    `created_by`      BIGINT NULL,
    `created_at`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY `idx_created_by` (`created_by`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
