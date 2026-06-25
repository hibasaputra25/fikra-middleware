-- =====================================================================
-- MIGRATION 004: Users
-- Tabel users lokal — menggantikan ketergantungan pada Moodle auth
-- =====================================================================

CREATE TABLE IF NOT EXISTS `users` (
    `id`            BIGINT AUTO_INCREMENT PRIMARY KEY,
    `username`      VARCHAR(100) NOT NULL,
    `email`         VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,             -- bcrypt
    `nama`          VARCHAR(200) NOT NULL,
    `role`          ENUM('siswa','guru','admin') NOT NULL DEFAULT 'siswa',
    `foto_url`      VARCHAR(500) NULL,
    `is_active`     TINYINT(1) NOT NULL DEFAULT 1,
    `moodle_id`     BIGINT NULL,                       -- referensi ke Moodle userid (untuk migrasi)
    `last_login_at` DATETIME NULL,
    `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY `uniq_username` (`username`),
    UNIQUE KEY `uniq_email` (`email`),
    KEY `idx_role` (`role`),
    KEY `idx_active` (`is_active`),
    KEY `idx_moodle_id` (`moodle_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Refresh token table — untuk invalidasi token saat logout
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
    `id`         BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id`    BIGINT NOT NULL,
    `token_hash` VARCHAR(64) NOT NULL,                 -- SHA256 dari refresh token
    `expires_at` DATETIME NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY `uniq_token` (`token_hash`),
    KEY `idx_user` (`user_id`),
    KEY `idx_expires` (`expires_at`),
    CONSTRAINT `fk_rt_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
