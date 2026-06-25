-- =====================================================================
-- MIGRATION 011: Subscription System
-- user_type, email verification, invite codes, subscriptions, payments,
-- ai_chat_usage
-- =====================================================================

-- 1. Tambah kolom ke tabel users
--    ER_DUP_FIELDNAME (1060) akan di-skip otomatis oleh migrate.js jika kolom sudah ada
ALTER TABLE `users` ADD COLUMN `user_type`         ENUM('kelas','subscription') NOT NULL DEFAULT 'kelas' AFTER `role`;
ALTER TABLE `users` ADD COLUMN `is_email_verified` TINYINT(1) NOT NULL DEFAULT 0                         AFTER `user_type`;
ALTER TABLE `users` ADD COLUMN `email_verified_at` DATETIME NULL                                         AFTER `is_email_verified`;

-- 2. Tabel email_verifications
--    Token untuk verifikasi email saat register
CREATE TABLE IF NOT EXISTS `email_verifications` (
    `id`         BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id`    BIGINT NOT NULL,
    `token`      VARCHAR(64) UNIQUE NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `used_at`    DATETIME NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY `idx_ev_user`    (`user_id`),
    KEY `idx_ev_token`   (`token`),
    KEY `idx_ev_expires` (`expires_at`),
    CONSTRAINT `fk_ev_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel invite_codes
--    Guru/admin generate kode untuk undang siswa kelas
CREATE TABLE IF NOT EXISTS `invite_codes` (
    `id`           INT AUTO_INCREMENT PRIMARY KEY,
    `code`         VARCHAR(16) UNIQUE NOT NULL,
    `created_by`   BIGINT NOT NULL,               -- guru_id atau admin_id
    `kurikulum_id` INT NULL,                       -- assign jenjang otomatis
    `max_uses`     INT NOT NULL DEFAULT 1,
    `used_count`   INT NOT NULL DEFAULT 0,
    `expires_at`   DATETIME NULL,
    `is_active`    TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY `idx_ic_code`       (`code`),
    KEY `idx_ic_created_by` (`created_by`),
    CONSTRAINT `fk_ic_created_by`   FOREIGN KEY (`created_by`)   REFERENCES `users`       (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ic_kurikulum`    FOREIGN KEY (`kurikulum_id`) REFERENCES `categories`  (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabel subscriptions
--    Satu user bisa punya satu subscription aktif
CREATE TABLE IF NOT EXISTS `subscriptions` (
    `id`          INT AUTO_INCREMENT PRIMARY KEY,
    `user_id`     BIGINT NOT NULL,
    `plan`        ENUM('free','premium') NOT NULL DEFAULT 'free',
    `status`      ENUM('active','expired','cancelled') NOT NULL DEFAULT 'active',
    `started_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expires_at`  DATETIME NULL,
    `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY `idx_sub_user`   (`user_id`),
    KEY `idx_sub_status` (`status`),
    CONSTRAINT `fk_sub_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabel payment_orders
--    Rekam setiap transaksi Midtrans
CREATE TABLE IF NOT EXISTS `payment_orders` (
    `id`               INT AUTO_INCREMENT PRIMARY KEY,
    `user_id`          BIGINT NOT NULL,
    `order_id`         VARCHAR(64) UNIQUE NOT NULL,   -- ID unik ke Midtrans
    `plan`             ENUM('premium') NOT NULL,
    `duration_months`  INT NOT NULL DEFAULT 1,
    `amount`           INT NOT NULL,                  -- rupiah
    `status`           ENUM('pending','paid','failed','expired') NOT NULL DEFAULT 'pending',
    `gateway_response` JSON NULL,                     -- raw response dari Midtrans
    `snap_token`       VARCHAR(255) NULL,             -- untuk redirect frontend
    `paid_at`          DATETIME NULL,
    `created_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY `idx_po_user`     (`user_id`),
    KEY `idx_po_status`   (`status`),
    KEY `idx_po_order_id` (`order_id`),
    CONSTRAINT `fk_po_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabel ai_chat_usage
--    Rate limiting harian untuk chat AI per user
CREATE TABLE IF NOT EXISTS `ai_chat_usage` (
    `id`       BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id`  BIGINT NOT NULL,
    `date`     DATE NOT NULL,
    `count`    INT NOT NULL DEFAULT 0,

    UNIQUE KEY `uniq_user_date` (`user_id`, `date`),
    KEY `idx_acu_user` (`user_id`),
    CONSTRAINT `fk_acu_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Set existing users sebagai verified (tidak memblokir akun lama)
UPDATE `users` SET `is_email_verified` = 1 WHERE `is_email_verified` = 0;

-- 8. Insert free subscription untuk semua user yang belum punya
INSERT INTO `subscriptions` (`user_id`, `plan`, `status`, `expires_at`)
SELECT `id`, 'free', 'active', NULL
FROM `users`
WHERE `id` NOT IN (SELECT `user_id` FROM `subscriptions`);
