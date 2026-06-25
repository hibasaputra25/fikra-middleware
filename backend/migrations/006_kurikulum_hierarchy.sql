-- =====================================================================
-- MIGRATION 006: Kurikulum Hierarchy
-- Tambah level kurikulum (SD, SMP, SMA/K, SNBT) sebagai parent
-- dari subtes yang sudah ada
-- =====================================================================

-- Ubah ENUM level agar support 'kurikulum'
ALTER TABLE `categories`
    MODIFY COLUMN `level`
        ENUM('kurikulum','subtes','topik','subtopik') NOT NULL;

-- Insert kurikulum
INSERT IGNORE INTO `categories` (`code`, `name`, `slug`, `level`, `sort_order`) VALUES
    ('SD',   'SD / MI',             'sd',   'kurikulum', 1),
    ('SMP',  'SMP / MTs',           'smp',  'kurikulum', 2),
    ('SMAK', 'SMA / SMK / MA',      'smak', 'kurikulum', 3),
    ('SNBT', 'SNBT / UTBK',         'snbt', 'kurikulum', 4);

-- Set parent_id subtes SNBT ke kurikulum SNBT
-- Kita pakai subquery untuk dapat id SNBT
UPDATE `categories`
SET `parent_id` = (SELECT id FROM (SELECT id FROM categories WHERE slug = 'snbt') AS tmp)
WHERE `level` = 'subtes'
  AND `code` IN ('PBM', 'PPU', 'PK', 'PM', 'PU', 'LBI', 'LBE');
