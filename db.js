const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'simbinwas_db', // Ganti dengan nama database yang sesuai
  password: 'admin123', // Masukkan password baru yang diset di pgAdmin tadi
  port: 5432,
});

pool.on('connect', () => {
  console.log('⚡ [SIMBINWAS] Berhasil terhubung ke database PostgreSQL (simbinwas_db)');
});

pool.on('error', (err) => {
  console.error('❌ [SIMBINWAS] Error koneksi PostgreSQL:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};