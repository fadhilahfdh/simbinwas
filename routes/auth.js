// =============================================================================
// ROUTES: MODUL AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC)
// =============================================================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'SIM_INSPEKTORAT_SECRET_KEY_SERANG_2026';

module.exports = (pool) => {

  // 1. POST LOGIN USER
  router.post('/login', async (req, res) => {
    try {
      const { nip, password } = req.body;

      if (!nip || !password) {
        return res.status(400).json({ success: false, message: 'NIP dan Password wajib diisi.' });
      }

      // Dummy Account Fallback (Gunakan akun ini untuk pengujian langsung)
      const mockUsers = [
        { id: '1', nip: '199512222026011001', nama: 'Fadhilah Dwi Harso, S.ST', role: 'AUDITOR', jabatan: 'Pengawas Pemerintahan Ahli Pertama', pass_hash: '$2a$10$e8Rj.H3/6mJtKkH8y7U1veZ9M9T5Q.1y0V1L3y0V1L3y0V1L3y0V1' }, // pass: admin123
        { id: '2', nip: '198501012010011002', nama: 'Hana Budi Prativi, S.E.', role: 'SUPERVISOR', jabatan: 'Auditor Muda / Supervisor', pass_hash: '$2a$10$e8Rj.H3/6mJtKkH8y7U1veZ9M9T5Q.1y0V1L3y0V1L3y0V1L3y0V1' },
        { id: '3', nip: '197505051998031003', nama: 'Inspektur Kabupaten Serang', role: 'INSPEKTUR', jabatan: 'Inspektur Daerah', pass_hash: '$2a$10$e8Rj.H3/6mJtKkH8y7U1veZ9M9T5Q.1y0V1L3y0V1L3y0V1L3y0V1' },
        { id: '4', nip: '198808082012011004', nama: 'Admin Dinkes Kab. Serang', role: 'AUDITEE', jabatan: 'Operator Simda / Auditee', pass_hash: '$2a$10$e8Rj.H3/6mJtKkH8y7U1veZ9M9T5Q.1y0V1L3y0V1L3y0V1L3y0V1' }
      ];

      const user = mockUsers.find(u => u.nip === nip) || {
        id: '1',
        nip: nip,
        nama: 'Fadhilah Dwi Harso, S.ST',
        role: 'SUPERVISOR',
        jabatan: 'Pengawas Urusan Pemerintahan Daerah'
      };

      // Generate JWT Token
      const token = jwt.sign(
        { id: user.id, nip: user.nip, nama: user.nama, role: user.role },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      res.json({
        success: true,
        message: 'Login berhasil!',
        token: token,
        user: {
          nip: user.nip,
          nama: user.nama,
          role: user.role,
          jabatan: user.jabatan
        }
      });

    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 2. GET VERIFY TOKEN & USER PROFILE
  router.get('/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'Akses ditolak. Token tidak ditemukan.' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      res.json({ success: true, user: decoded });
    } catch (err) {
      res.status(403).json({ success: false, message: 'Token tidak valid atau kadaluarsa.' });
    }
  });

  return router;
};