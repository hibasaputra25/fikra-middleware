# Setup Plugin Moodle `local_fikra_auth`

Plugin ini memungkinkan backend Express Fikra untuk generate token Moodle per user tanpa butuh password.

## Status Deployment

✅ Plugin sudah ter-install di server Moodle
✅ Backend sudah dikonfigurasi untuk pakai plugin ini

---

## Cara Kerja

1. User login ke platform Fikra → backend verifikasi ke Moodle
2. Backend hit endpoint plugin: `GET /local/fikra_auth/token.php?username=xxx&secret=yyy`
3. Plugin generate atau return existing token untuk user tersebut
4. Backend pakai token ini untuk operasi quiz atas nama user

---

## File Plugin di Server Moodle

Lokasi: `/var/www/html/moodle/local/fikra_auth/`

```
/var/www/html/moodle/local/fikra_auth/
├── version.php   → metadata plugin
├── index.php     → required by Moodle
└── token.php     → endpoint utama
```

---

## Konfigurasi yang Diperlukan

### 1. Di Server Moodle

**Service:** `moodle_mobile_app` (sudah enabled)

**Secret key:** Set via environment variable Apache

Edit `/etc/apache2/envvars`:
```bash
export FIKRA_MOODLE_SECRET="your-secret-key-here"
```

Lalu restart Apache:
```bash
sudo systemctl restart apache2
```

### 2. Di Backend Express

Tambahkan ke `.env`:
```
FIKRA_MOODLE_SECRET=your-secret-key-here
```

**PENTING:** Secret di kedua tempat harus sama.

---

## Testing

Dari terminal server Moodle:
```bash
curl "http://192.168.0.22/local/fikra_auth/token.php?username=fikra_academy&secret=fikra-secret-change-this"
```

Response yang diharapkan:
```json
{
  "token": "6d5f80b10182709830ca00af697adbfb",
  "userid": 2,
  "username": "fikra_academy",
  "fullname": "Fikra Academy"
}
```

Dari backend Express (setelah implement route quiz):
```javascript
const { getUserToken } = require('./config/moodle');
const tokenData = await getUserToken('fikra_academy');
console.log(tokenData.token);
```

---

## Upgrade Plugin (jika ada perubahan)

Setelah edit file plugin:
```bash
sudo -u www-data php /var/www/html/moodle/admin/cli/upgrade.php --non-interactive
```

---

## Security Notes

1. **Secret key** harus kuat dan unik (min 32 karakter random)
2. Jangan commit secret ke Git
3. Plugin ini hanya boleh diakses dari backend Express, tidak dari internet publik
4. Consider firewall rule untuk block akses ke `/local/fikra_auth/` dari IP selain backend

---

## Troubleshooting

### Error: "Unauthorized"
- Secret di `.env` tidak cocok dengan secret di server Moodle
- Cek environment variable Apache: `sudo grep FIKRA /etc/apache2/envvars`

### Error: "Service not found"
- Service `moodle_mobile_app` tidak enabled
- Cek: Site administration → Server → Web services → Manage services

### Error: "User not found"
- Username salah atau user suspended/deleted di Moodle
- Cek user: `mysql -u moodleuser -p -e "SELECT id, username, deleted, suspended FROM moodle.mdl_user WHERE username='xxx';"`

### 404 Not Found
- Plugin belum ter-install
- Jalankan: `sudo -u www-data php /var/www/html/moodle/admin/cli/upgrade.php --non-interactive`
