<?php
// Plugin: local_fikra_auth
// Endpoint untuk generate Moodle token per user
// Dipanggil oleh backend Express Fikra

defined('MOODLE_INTERNAL') || die();

$plugin->component = 'local_fikra_auth';
$plugin->version   = 2024010100;
$plugin->requires  = 2023042400; // Moodle 4.0+
$plugin->maturity  = MATURITY_STABLE;
$plugin->release   = '1.0.0';
