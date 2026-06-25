const nodemailer = require('nodemailer');

// =====================================================================
// TRANSPORTER
// Dibuat fresh setiap kali agar selalu pakai env terbaru
// =====================================================================

function getTransporter() {
    return nodemailer.createTransport({
        host:   process.env.EMAIL_HOST   || 'smtp-relay.brevo.com',
        port:   parseInt(process.env.EMAIL_PORT || '587'),
        secure: false, // STARTTLS
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
}

function getFromAddress() {
    return process.env.EMAIL_FROM || process.env.EMAIL_USER;
}

function getFromName() {
    return process.env.EMAIL_FROM_NAME || 'Fikra Academy';
}

function getAppUrl() {
    return process.env.APP_URL || 'http://localhost:3000';
}

// =====================================================================
// HELPERS
// =====================================================================

function baseTemplate(title, bodyHtml) {
    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; background:#f4f6f8; font-family: 'Segoe UI', Arial, sans-serif; }
    .wrapper { max-width:560px; margin:40px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.08); }
    .header  { background:#1d4ed8; padding:28px 32px; text-align:center; }
    .header h1 { margin:0; color:#fff; font-size:22px; letter-spacing:.5px; }
    .body    { padding:32px; color:#374151; font-size:15px; line-height:1.6; }
    .body h2 { margin-top:0; color:#111827; font-size:18px; }
    .btn     { display:inline-block; margin:20px 0; padding:12px 28px; background:#1d4ed8; color:#fff !important; text-decoration:none; border-radius:8px; font-weight:600; font-size:15px; }
    .footer  { padding:20px 32px; background:#f9fafb; border-top:1px solid #e5e7eb; font-size:12px; color:#9ca3af; text-align:center; }
    .code    { display:inline-block; padding:10px 20px; background:#eff6ff; border:1px dashed #93c5fd; border-radius:6px; font-size:20px; font-weight:700; letter-spacing:4px; color:#1d4ed8; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>Fikra Academy</h1></div>
    <div class="body">${bodyHtml}</div>
    <div class="footer">Email ini dikirim otomatis. Jangan balas email ini.<br/>© ${new Date().getFullYear()} Fikra Academy</div>
  </div>
</body>
</html>`;
}

// =====================================================================
// SEND EMAIL VERIFICATION
// =====================================================================
async function sendVerificationEmail(user, token) {
    const APP_URL = getAppUrl();
    const link = `${APP_URL}/verify-email?token=${token}`;

    const html = baseTemplate('Verifikasi Email Kamu', `
        <h2>Hei, ${user.nama}!</h2>
        <p>Terima kasih sudah mendaftar di <strong>Fikra Academy</strong>. Satu langkah lagi — verifikasi email kamu untuk mengaktifkan akun.</p>
        <p style="text-align:center">
            <a href="${link}" class="btn">Verifikasi Email</a>
        </p>
        <p style="font-size:13px;color:#6b7280;">
            Link ini berlaku selama <strong>24 jam</strong>. Jika kamu tidak mendaftar di Fikra Academy, abaikan email ini.
        </p>
        <p style="font-size:13px;color:#6b7280;">Atau salin link berikut ke browser:<br/><code style="word-break:break-all">${link}</code></p>
    `);

    await getTransporter().sendMail({
        from:    `"${getFromName()}" <${getFromAddress()}>`,
        to:      user.email,
        subject: 'Verifikasi Email Fikra Academy',
        html,
    });
}

// =====================================================================
// SEND INVITE EMAIL (guru undang siswa manual)
// =====================================================================
async function sendInviteEmail({ toEmail, toNama, guruNama, inviteLink, expiresAt }) {
    const expStr = expiresAt
        ? new Date(expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;

    const html = baseTemplate('Undangan Bergabung ke Fikra Academy', `
        <h2>Hei, ${toNama || 'Calon Siswa'}!</h2>
        <p>Kamu diundang oleh <strong>${guruNama}</strong> untuk bergabung ke kelas di <strong>Fikra Academy</strong>.</p>
        <p style="text-align:center">
            <a href="${inviteLink}" class="btn">Terima Undangan & Daftar</a>
        </p>
        ${expStr ? `<p style="font-size:13px;color:#6b7280;">Undangan ini berlaku hingga <strong>${expStr}</strong>.</p>` : ''}
        <p style="font-size:13px;color:#6b7280;">Atau salin link berikut ke browser:<br/><code style="word-break:break-all">${inviteLink}</code></p>
    `);

    await getTransporter().sendMail({
        from:    `"${getFromName()}" <${getFromAddress()}>`,
        to:      toEmail,
        subject: `${guruNama} mengundang kamu ke Fikra Academy`,
        html,
    });
}

// =====================================================================
// SEND PAYMENT SUCCESS
// =====================================================================
async function sendPaymentSuccessEmail(user, order) {
    const APP_URL = getAppUrl();
    const expiresStr = order.expires_at
        ? new Date(order.expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : '-';

    const html = baseTemplate('Pembayaran Berhasil!', `
        <h2>Hei, ${user.nama}!</h2>
        <p>Pembayaran subscription <strong>Premium</strong> kamu berhasil diproses.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
            <tr style="background:#f9fafb"><td style="padding:8px 12px;border:1px solid #e5e7eb">Order ID</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${order.order_id}</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Plan</td><td style="padding:8px 12px;border:1px solid #e5e7eb">Premium</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px 12px;border:1px solid #e5e7eb">Durasi</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${order.duration_months} bulan</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Berlaku hingga</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${expiresStr}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px 12px;border:1px solid #e5e7eb">Total</td><td style="padding:8px 12px;border:1px solid #e5e7eb"><strong>Rp ${order.amount.toLocaleString('id-ID')}</strong></td></tr>
        </table>
        <p>Selamat menikmati fitur Premium Fikra Academy!</p>
        <p style="text-align:center"><a href="${APP_URL}/siswa/subscription" class="btn">Lihat Dashboard</a></p>
    `);

    await getTransporter().sendMail({
        from:    `"${getFromName()}" <${getFromAddress()}>`,
        to:      user.email,
        subject: 'Pembayaran Premium Berhasil - Fikra Academy',
        html,
    });
}

// =====================================================================
// VERIFY TRANSPORTER (untuk health check)
// =====================================================================
async function verifyConnection() {
    return getTransporter().verify();
}

module.exports = {
    sendVerificationEmail,
    sendInviteEmail,
    sendPaymentSuccessEmail,
    verifyConnection,
};
