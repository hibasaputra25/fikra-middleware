-- =====================================================================
-- MIGRATION 008: Fix kode dan nama subtes SNBT
-- Sesuai standar resmi:
--   Penalaran Umum (PU)
--   Pengetahuan dan Pemahaman Umum (PPU)
--   Pemahaman Bacaan dan Menulis (PBM)
--   Pengetahuan Kuantitatif (PK)
--   Literasi Bahasa Indonesia (LBI)
--   Literasi Bahasa Inggris (LBE)
--   Penalaran Matematika (PM)
-- =====================================================================

-- id=1: PBM -> PU (Penalaran Umum)
UPDATE `categories` SET `code` = 'PU',  `name` = 'Penalaran Umum',                   `slug` = 'penalaran-umum'                   WHERE `id` = 1;

-- id=2: PPU tetap (Pengetahuan dan Pemahaman Umum)
-- tidak ada perubahan

-- id=3: PK -> PBM (Pemahaman Bacaan dan Menulis)
UPDATE `categories` SET `code` = 'PBM', `name` = 'Pemahaman Bacaan dan Menulis',      `slug` = 'pemahaman-bacaan-menulis'          WHERE `id` = 3;

-- id=4: PM -> PK (Pengetahuan Kuantitatif)
UPDATE `categories` SET `code` = 'PK',  `name` = 'Pengetahuan Kuantitatif',           `slug` = 'pengetahuan-kuantitatif'           WHERE `id` = 4;

-- id=5: PU -> PM (Penalaran Matematika)
UPDATE `categories` SET `code` = 'PM',  `name` = 'Penalaran Matematika',              `slug` = 'penalaran-matematika'              WHERE `id` = 5;

-- id=6: LBI tetap (Literasi Bahasa Indonesia)
-- tidak ada perubahan

-- id=7: LBE tetap (Literasi Bahasa Inggris)
-- tidak ada perubahan
