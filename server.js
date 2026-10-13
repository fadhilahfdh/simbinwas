const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

// 1. API Authentikasi / User Info
// 1. API Authentikasi / User Info
app.post('/api/auth/login', async (req, res) => {
  const { nip, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM "users" WHERE nip = $1', [nip]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'NIP tidak terdaftar dalam sistem.' });
    }
    
    const user = result.rows[0];

    // Validasi pencocokan password
    if (user.password !== password) {
      return res.status(401).json({ success: false, message: 'Password salah!' });
    }

    // Jika NIP dan Password benar
    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error server database' });
  }
});

// 2. API Data Pegawai (Untuk Dropdown Susunan Tim ST)
app.get('/api/users', async (req, res) => {
  try {
    const result = await db.query('SELECT id, nip, nama, role, jabatan_fungsional, jenjang_jabatan FROM "users" ORDER BY nama ASC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. API Data Obrik
app.get('/api/obrik', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM obrik ORDER BY nama_obrik ASC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. API Pemantauan TLHP (Dinamis dari Database)
app.get('/api/tlhp', async (req, res) => {
  try {
    const queryText = `
      SELECT f.*, o.nama_obrik, o.kategori 
      FROM tlhp_findings f
      JOIN obrik o ON f.obrik_id = o.id
      ORDER BY f.created_at DESC
    `;
    const result = await db.query(queryText);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Simulasi penyimpanan OTP sementara (di memori server)
const otpStorage = {};

// 1. API Kirim Kode Verifikasi (Lupa Password)
app.post('/api/auth/forgot-password', async (req, res) => {
  const { nip, kontak } = req.body; // kontak bisa berupa email atau no_hp
  try {
    const result = await db.query('SELECT * FROM "users" WHERE nip = $1', [nip]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'NIP tidak terdaftar dalam sistem.' });
    }

    const user = result.rows[0];
    
    // Validasi opsional: pastikan email atau no_hp cocok jika ingin diperketat
    // (Misal: user.email === kontak || user.noHp === kontak)

    // Generate kode OTP acak 4 digit (Contoh: "4829")
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Simpan OTP dengan masa berlaku atau langsung ke objek sementara
    otpStorage[nip] = {
      code: otpCode,
      expiresAt: Date.now() + 5 * 60 * 1000 // Berlaku 5 menit
    };

    // Simulasi pengiriman: Karena ini lokal, kita tampilkan OTP-nya di console terminal server
    console.log(`\n========================================`);
    console.log(`🔐 KODE OTP LUPA PASSWORD UNTUK NIP ${nip}: ${otpCode}`);
    console.log(`========================================\n`);
    
    res.json({ 
      success: true, 
      message: 'Kode verifikasi telah dikirim ke kontak terdaftar.',
      // Untuk memudahkan testing lokal, kita kirim balik debugOTP (bisa dihapus nanti saat production)
      debugOtp: otpCode 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
  }
});

// 2. API Verifikasi OTP & Simpan Password Baru
app.post('/api/auth/verify-reset', async (req, res) => {
  const { nip, otp, newPassword } = req.body;
  try {
    const storedData = otpStorage[nip];

    if (!storedData) {
      return res.status(400).json({ success: false, message: 'Belum ada permintaan reset password untuk NIP ini.' });
    }

    if (Date.now() > storedData.expiresAt) {
      delete otpStorage[nip];
      return res.status(400).json({ success: false, message: 'Kode verifikasi telah kedaluwarsa. Silakan minta ulang.' });
    }

    if (storedData.code !== otp) {
      return res.status(400).json({ success: false, message: 'Kode verifikasi (OTP) salah!' });
    }

    // Jika OTP benar, update password ke database PostgreSQL
    await db.query('UPDATE "users" SET password = $1 WHERE nip = $2', [newPassword, nip]);

    // Hapus OTP dari memori setelah sukses digunakan
    delete otpStorage[nip];

    res.json({ success: true, message: 'Password berhasil diubah! Silakan login dengan password baru Anda.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui password.' });
  }
});

// Serve Frontend Catch-All (Sintaks Express Terbaru)
app.get('/{0,}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server SIMBINWAS berjalan dinamis di http://localhost:${PORT}`);
});