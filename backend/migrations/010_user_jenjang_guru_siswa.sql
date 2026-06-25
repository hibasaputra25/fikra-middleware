-- =====================================================================
-- MIGRATION 010: User Jenjang + Relasi Guru-Siswa
-- =====================================================================
-- user_jenjang : siswa bisa terdaftar di beberapa jenjang
-- guru_siswa   : many-to-many guru <-> siswa
-- created_by   : soal punya pemilik (guru privat)
-- =====================================================================

-- 1. created_by di questions sudah ada dari schema awal, skip ALTER
-- (kolom created_by sudah ada di schema.sql baris questions)

-- 2. Tabel relasi siswa <-> jenjang (kurikulum)
--    Satu siswa bisa terdaftar di beberapa jenjang
CREATE TABLE IF NOT EXISTS `user_jenjang` (
    `id`           INT AUTO_INCREMENT PRIMARY KEY,
    `user_id`      BIGINT NOT NULL,          -- siswa
    `kurikulum_id` INT    NOT NULL,          -- FK ke categories (level=kurikulum)
    `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY `uniq_user_kurikulum` (`user_id`, `kurikulum_id`),
    KEY `idx_user`      (`user_id`),
    KEY `idx_kurikulum` (`kurikulum_id`),
    CONSTRAINT `fk_uj_user`      FOREIGN KEY (`user_id`)      REFERENCES `users`      (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_uj_kurikulum` FOREIGN KEY (`kurikulum_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3. Tabel relasi guru <-> siswa
--    Guru mengajar siswa tertentu; siswa hanya lihat konten dari gurunya
CREATE TABLE IF NOT EXISTS `guru_siswa` (
    `id`         INT AUTO_INCREMENT PRIMARY KEY,
    `guru_id`    BIGINT NOT NULL,
    `siswa_id`   BIGINT NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY `uniq_guru_siswa` (`guru_id`, `siswa_id`),
    KEY `idx_guru`  (`guru_id`),
    KEY `idx_siswa` (`siswa_id`),
    CONSTRAINT `fk_gs_guru`  FOREIGN KEY (`guru_id`)  REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_gs_siswa` FOREIGN KEY (`siswa_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 4. Index created_by di latihan_paket — skip jika sudah ada (idempotent via migrate.js)
CREATE INDEX `idx_lp_created_by` ON `latihan_paket` (`created_by`);
