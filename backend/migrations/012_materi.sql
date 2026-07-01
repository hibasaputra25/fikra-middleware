-- =====================================================================
-- MIGRATION 012: Materi / Learning Materials
-- Guru & admin bisa upload materi (PDF, DOCX, PPTX, gambar, video URL)
-- Materi dikategorikan per kurikulum dan opsional per subtes
-- =====================================================================

CREATE TABLE IF NOT EXISTS `materi` (
    `id`            INT AUTO_INCREMENT PRIMARY KEY,
    `judul`         VARCHAR(255)                        NOT NULL,
    `deskripsi`     TEXT                                NULL,
    `jenis`         ENUM('file','video_url','link')      NOT NULL DEFAULT 'file',

    -- Untuk jenis = 'file': path relatif, misal /uploads/materi/xxx.pdf
    `file_url`      VARCHAR(500)                        NULL,
    -- Untuk jenis = 'video_url': YouTube/Vimeo/dll URL
    `video_url`     VARCHAR(500)                        NULL,
    -- Untuk jenis = 'link': URL eksternal
    `link_url`      VARCHAR(500)                        NULL,

    `mime_type`     VARCHAR(100)                        NULL,
    `file_size`     INT UNSIGNED                        NULL,
    `original_name` VARCHAR(255)                        NULL,

    -- Kategorisasi
    `kurikulum_id`  INT                                 NOT NULL,
    `subtes_id`     INT                                 NULL,

    -- Metadata
    `created_by`    BIGINT                              NOT NULL,
    `is_active`     TINYINT(1)          NOT NULL DEFAULT 1,
    `sort_order`    INT                 NOT NULL DEFAULT 0,
    `created_at`    TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY `idx_kurikulum`  (`kurikulum_id`),
    KEY `idx_subtes`     (`subtes_id`),
    KEY `idx_created_by` (`created_by`),
    KEY `idx_is_active`  (`is_active`),

    CONSTRAINT `fk_materi_kurikulum` FOREIGN KEY (`kurikulum_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_materi_subtes`    FOREIGN KEY (`subtes_id`)    REFERENCES `categories` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_materi_creator`   FOREIGN KEY (`created_by`)   REFERENCES `users`      (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
