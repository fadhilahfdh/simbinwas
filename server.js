const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serving Static Files (UI Frontend)
app.use(express.static('public'));

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'sim_inspektorat',
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Gagal koneksi ke database PostgreSQL:', err.stack);
  }
  console.log('✅ Terhubung secara sukses ke database PostgreSQL sim_inspektorat!');
  release();
});

// Mount Routes Modul Pengawasan Core, Security, & TLHP
const pkptRoutes = require('./routes/pkpt')(pool);
const sptRoutes = require('./routes/spt')(pool);
const kkpRoutes = require('./routes/kkp')(pool);
const lhpRoutes = require('./routes/lhp')(pool);
const tlhpRoutes = require('./routes/tlhp')(pool);

app.use('/api/pkpt', pkptRoutes);
app.use('/api/spt', sptRoutes);
app.use('/api/kkp', kkpRoutes);
app.use('/api/lhp', lhpRoutes);
app.use('/api/tlhp', tlhpRoutes);

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as db_time');
    res.json({
      status: 'OK',
      system: 'SIM-Inspektorat Backend Engine Running',
      db_time: result.rows[0].db_time,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server SIM-Inspektorat berjalan di: http://localhost:${port}`);
  console.log(`   --> Main Portal Hub : http://localhost:${port}/index.html`);
  console.log(`   --> UI PKPT Calendar: http://localhost:${port}/pkpt-calendar.html`);
  console.log(`   --> UI KKP Review   : http://localhost:${port}/kkp-review.html`);
  console.log(`   --> UI TLHP Control : http://localhost:${port}/tlhp-dashboard.html`);
  console.log(`   --> Route PKPT Ready : http://localhost:${port}/api/pkpt`);
  console.log(`   --> Route SPT Ready  : http://localhost:${port}/api/spt`);
  console.log(`   --> Route KKP Ready  : http://localhost:${port}/api/kkp`);
  console.log(`   --> Route LHP Ready  : http://localhost:${port}/api/lhp`);
  console.log(`   --> Route TLHP Ready : http://localhost:${port}/api/tlhp`);
});