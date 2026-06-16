<?php
/**
 * local_fikra_auth/token.php
 *
 * Endpoint untuk generate Moodle WS token per user.
 * Dipanggil oleh backend Express Fikra dengan secret key.
 *
 * Request:
 *   GET /local/fikra_auth/token.php?username=siswa1&secret=YOUR_SECRET
 *
 * Response (JSON):
 *   { "token": "abc123...", "userid": 42 }
 *   { "error": "pesan error" }
 *
 * PENTING: Simpan FIKRA_SECRET di luar webroot atau di config Moodle.
 */

// Bootstrap Moodle tanpa require login
define('NO_MOODLE_COOKIES', true);
require_once('../../config.php');
require_once($CFG->libdir . '/externallib.php');

header('Content-Type: application/json');

// --- 1. Validasi secret key ---
$secret = required_param('secret', PARAM_RAW);
$expectedSecret = get_config('local_fikra_auth', 'secret');

if (empty($expectedSecret)) {
    // Fallback: baca dari environment variable jika config belum di-set
    $expectedSecret = getenv('FIKRA_MOODLE_SECRET');
}

if (empty($expectedSecret) || !hash_equals($expectedSecret, $secret)) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// --- 2. Ambil username dari request ---
$username = required_param('username', PARAM_USERNAME);

if (empty($username)) {
    http_response_code(400);
    echo json_encode(['error' => 'Username required']);
    exit;
}

// --- 3. Cari user di Moodle ---
$user = $DB->get_record('user', ['username' => $username, 'deleted' => 0, 'suspended' => 0]);

if (!$user) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found']);
    exit;
}

// --- 4. Cari service yang akan dipakai ---
$serviceShortname = get_config('local_fikra_auth', 'service_shortname');
if (empty($serviceShortname)) {
    $serviceShortname = 'Webservice-85THo'; // default dari config project
}

$service = $DB->get_record('external_services', ['shortname' => $serviceShortname, 'enabled' => 1]);

if (!$service) {
    http_response_code(500);
    echo json_encode(['error' => 'Service not found or disabled: ' . $serviceShortname]);
    exit;
}

// --- 5. Cek apakah token sudah ada untuk user + service ini ---
$existingToken = $DB->get_record('external_tokens', [
    'userid'            => $user->id,
    'externalserviceid' => $service->id,
    'tokentype'         => EXTERNAL_TOKEN_PERMANENT,
]);

if ($existingToken) {
    // Gunakan token yang sudah ada
    echo json_encode([
        'token'    => $existingToken->token,
        'userid'   => (int) $user->id,
        'username' => $user->username,
    ]);
    exit;
}

// --- 6. Generate token baru ---
try {
    $context = context_system::instance();

    // Pastikan user punya akses ke service
    external_add_user_to_allowed_on_service($user->id, $service->id);

    $token = external_generate_token(
        EXTERNAL_TOKEN_PERMANENT,
        $service->id,
        $user->id,
        $context,
        0,   // validuntil: 0 = tidak expired
        ''   // iprestriction: kosong = semua IP
    );

    echo json_encode([
        'token'    => $token,
        'userid'   => (int) $user->id,
        'username' => $user->username,
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
