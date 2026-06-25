-- =====================================================================
-- MIGRATION 009: Mapel per Jenjang (SD, SMP, SMA/K)
-- =====================================================================

-- =====================================================================
-- SD (id=8)
-- =====================================================================
INSERT IGNORE INTO `categories` (`parent_id`, `code`, `name`, `slug`, `level`, `sort_order`) VALUES
    (8, 'SD-MTK',  'Matematika',       'matematika-sd',        'subtes', 1),
    (8, 'SD-BIN',  'Bahasa Indonesia',  'bahasa-indonesia-sd',  'subtes', 2),
    (8, 'SD-IPA',  'IPA',              'ipa-sd',               'subtes', 3),
    (8, 'SD-IPS',  'IPS',              'ips-sd',               'subtes', 4),
    (8, 'SD-BING', 'Bahasa Inggris',   'bahasa-inggris-sd',    'subtes', 5);

-- =====================================================================
-- SMP (id=9)
-- =====================================================================
INSERT IGNORE INTO `categories` (`parent_id`, `code`, `name`, `slug`, `level`, `sort_order`) VALUES
    (9, 'SMP-MTK',  'Matematika',       'matematika-smp',       'subtes', 1),
    (9, 'SMP-BIN',  'Bahasa Indonesia',  'bahasa-indonesia-smp', 'subtes', 2),
    (9, 'SMP-IPA',  'IPA',              'ipa-smp',              'subtes', 3),
    (9, 'SMP-IPS',  'IPS',              'ips-smp',              'subtes', 4),
    (9, 'SMP-BING', 'Bahasa Inggris',   'bahasa-inggris-smp',   'subtes', 5);

-- =====================================================================
-- SMA/K (id=10)
-- =====================================================================
INSERT IGNORE INTO `categories` (`parent_id`, `code`, `name`, `slug`, `level`, `sort_order`) VALUES
    (10, 'SMA-MTK',  'Matematika',       'matematika-sma',       'subtes', 1),
    (10, 'SMA-FIS',  'Fisika',           'fisika-sma',           'subtes', 2),
    (10, 'SMA-KIM',  'Kimia',            'kimia-sma',            'subtes', 3),
    (10, 'SMA-BIO',  'Biologi',          'biologi-sma',          'subtes', 4),
    (10, 'SMA-BING', 'Bahasa Inggris',   'bahasa-inggris-sma',   'subtes', 5),
    (10, 'SMA-BIN',  'Bahasa Indonesia',  'bahasa-indonesia-sma', 'subtes', 6),
    (10, 'SMA-EKO',  'Ekonomi',          'ekonomi-sma',          'subtes', 7),
    (10, 'SMA-GEO',  'Geografi',         'geografi-sma',         'subtes', 8),
    (10, 'SMA-SOS',  'Sosiologi',        'sosiologi-sma',        'subtes', 9);
