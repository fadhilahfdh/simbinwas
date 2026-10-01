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
app.post('/api/auth/login', async (req, res) => {
  const { nip } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE nip = $1', [nip]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'NIP tidak terdaftar dalam sistem.' });
    }
    const user = result.rows[0];
    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error server database' });
  }
});

// 2. API Data Pegawai (Untuk Dropdown Susunan Tim ST)
app.get('/api/users', async (req, res) => {
  try {
    const result = await db.query('SELECT id, nip, nama, role, jabatan_fungsional, jenjang_jabatan FROM users ORDER BY nama ASC');
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

// Serve Frontend Catch-All (Sintaks Express Terbaru)
app.get('/{0,}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server SIMBINWAS berjalan dinamis di http://localhost:${PORT}`);
});