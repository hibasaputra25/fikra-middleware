-- =====================================================================
-- MIGRATION 005: Sesi Kelas, Absensi, Report, dan Kurikulum Guru
-- =====================================================================

-- Tabel sesi mengajar
CREATE TABLE IF NOT EXISTS `sesi_kelas` (
    `id`           INT AUTO_INCREMENT PRIMARY KEY,
    `guru_id`      BIGINT NOT NULL,
    `guru_nama`    VARCHAR(200) NOT NULL,
    `tanggal`      DATE NOT NULL,
    `jenjang`      VARCHAR(50) NOT NULL,
    `mapel`        TEXT NOT NULL,              -- bisa JSON array
    `durasi_menit` INT NOT NULL DEFAULT 60,
    `status`       ENUM('draft','selesai') NOT NULL DEFAULT 'draft',
    `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY `idx_guru` (`guru_id`),
    KEY `idx_tanggal` (`tanggal`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Absensi siswa per sesi
CREATE TABLE IF NOT EXISTS `sesi_absensi` (
    `id`          INT AUTO_INCREMENT PRIMARY KEY,
    `sesi_id`     INT NOT NULL,
    `user_id`     BIGINT NULL,
    `nama_siswa`  VARCHAR(200) NOT NULL,
    `status`      ENUM('hadir','izin','sakit','alfa') NOT NULL DEFAULT 'hadir',
    `catatan`     TEXT NULL,
    `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY `idx_sesi` (`sesi_id`),
    KEY `idx_user` (`user_id`),
    CONSTRAINT `fk_absensi_sesi` FOREIGN KEY (`sesi_id`)
        REFERENCES `sesi_kelas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Report/laporan sesi
CREATE TABLE IF NOT EXISTS `sesi_report` (
    `id`                  INT AUTO_INCREMENT PRIMARY KEY,
    `sesi_id`             INT NOT NULL,
    `topik`               VARCHAR(300) NOT NULL,
    `target_pembelajaran` TEXT NULL,
    `capaian`             ENUM('tercapai','sebagian','tidak_tercapai') NOT NULL DEFAULT 'tercapai',
    `catatan_materi`      TEXT NULL,
    `kondisi_kelas`       ENUM('kondusif','cukup','kurang_kondusif') NOT NULL DEFAULT 'kondusif',
    `fokus_siswa`         TINYINT NOT NULL DEFAULT 3, -- 1-5
    `kendala`             JSON NULL,
    `catatan_umum`        TEXT NULL,
    `created_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY `uniq_sesi` (`sesi_id`),
    CONSTRAINT `fk_report_sesi` FOREIGN KEY (`sesi_id`)
        REFERENCES `sesi_kelas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Catatan per siswa per sesi
CREATE TABLE IF NOT EXISTS `sesi_catatan_siswa` (
    `id`          INT AUTO_INCREMENT PRIMARY KEY,
    `sesi_id`     INT NOT NULL,
    `user_id`     BIGINT NULL,
    `nama_siswa`  VARCHAR(200) NOT NULL,
    `kondisi`     ENUM('baik','cukup','kurang') NOT NULL DEFAULT 'baik',
    `fokus`       ENUM('fokus','cukup','tidak_fokus') NOT NULL DEFAULT 'fokus',
    `catatan`     TEXT NULL,
    `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY `uniq_sesi_user` (`sesi_id`, `user_id`),
    KEY `idx_sesi` (`sesi_id`),
    CONSTRAINT `fk_catatan_sesi` FOREIGN KEY (`sesi_id`)
        REFERENCES `sesi_kelas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Mapping guru ke kurikulum yang diajarkan
CREATE TABLE IF NOT EXISTS `guru_kurikulum` (
    `id`            INT AUTO_INCREMENT PRIMARY KEY,
    `user_id`       BIGINT NOT NULL,
    `kurikulum_id`  INT NOT NULL,
    `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY `uniq_guru_kurikulum` (`user_id`, `kurikulum_id`),
    KEY `idx_user` (`user_id`),
    KEY `idx_kurikulum` (`kurikulum_id`),
    CONSTRAINT `fk_gk_kurikulum` FOREIGN KEY (`kurikulum_id`)
        REFERENCES `categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
