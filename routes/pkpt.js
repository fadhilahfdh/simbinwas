const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // 1. GET ALL PKPT
  router.get('/', async (req, res) => {
    try {
      const query = `
        SELECT 
          ph.id as pkpt_id,
          ph.tahun_anggaran,
          ph.nomor_pkpt,
          ph.status,
          COUNT(pk.id) as total_kegiatan
        FROM pkpt_header ph
        LEFT JOIN pkpt_detail_kegiatan pk ON ph.id = pk.pkpt_id
        GROUP BY ph.id
        ORDER BY ph.tahun_anggaran DESC;
      `;
      const result = await pool.query(query);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 2. POST PKPT HEADER
  router.post('/', async (req, res) => {
    try {
      const { tahun_anggaran, nomor_pkpt } = req.body;
      const query = `
        INSERT INTO pkpt_header (tahun_anggaran, nomor_pkpt)
        VALUES ($1, $2) RETURNING *;
      `;
      const result = await pool.query(query, [tahun_anggaran, nomor_pkpt]);
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 3. POST DETAIL KEGIATAN & OBRIK
  router.post('/kegiatan', async (req, res) => {
    try {
      const { pkpt_id, obrik_id, nama_kegiatan, skor_risiko, alokasi_hp } = req.body;
      const query = `
        INSERT INTO pkpt_detail_kegiatan (pkpt_id, obrik_id, nama_kegiatan, skor_risiko, alokasi_hp)
        VALUES ($1, $2, $3, $4, $5) RETURNING *;
      `;
      const result = await pool.query(query, [pkpt_id, obrik_id, nama_kegiatan, skor_risiko || 0, alokasi_hp]);
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 4. POST PENJADWALAN & ANGGOTA TIM (Trigger Anti-Bentrok)
  router.post('/jadwal-tim', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { pkpt_detail_id, tgl_mulai, tgl_selesai, tim_members } = req.body;

      const insertJadwalQuery = `
        INSERT INTO penugasan_jadwal (pkpt_detail_id, tgl_mulai, tgl_selesai)
        VALUES ($1, $2, $3) RETURNING id;
      `;
      const jadwalRes = await client.query(insertJadwalQuery, [pkpt_detail_id, tgl_mulai, tgl_selesai]);
      const jadwalId = jadwalRes.rows[0].id;

      const insertMemberQuery = `
        INSERT INTO penugasan_tim_member (jadwal_id, pegawai_id, peran_dalam_tim)
        VALUES ($1, $2, $3) RETURNING *;
      `;

      const addedMembers = [];
      for (const member of tim_members) {
        const memberRes = await client.query(insertMemberQuery, [
          jadwalId,
          member.pegawai_id,
          member.peran_dalam_tim
        ]);
        addedMembers.push(memberRes.rows[0]);
      }

      await client.query('COMMIT');
      res.status(201).json({
        success: true,
        message: 'Jadwal dan Anggota Tim berhasil dialokasikan.',
        jadwal_id: jadwalId,
        members: addedMembers
      });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(400).json({
        success: false,
        error_code: 'SCHEDULE_COLLISION',
        message: error.message
      });
    } finally {
      client.release();
    }
  });

  return router;
};