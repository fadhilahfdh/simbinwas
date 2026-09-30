const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // 1. GET ALL SPT
  router.get('/', async (req, res) => {
    try {
      const query = `
        SELECT 
          spt.id,
          spt.nomor_spt,
          spt.tgl_spt,
          spt.status_spt,
          ob.nama_obrik,
          pj.tgl_mulai,
          pj.tgl_selesai,
          mp.nama as penandatangan
        FROM surat_perintah_tugas spt
        JOIN penugasan_jadwal pj ON spt.jadwal_id = pj.id
        JOIN pkpt_detail_kegiatan pd ON pj.pkpt_detail_id = pd.id
        JOIN master_obrik ob ON pd.obrik_id = ob.id
        LEFT JOIN master_pegawai mp ON spt.penandatangan_id = mp.id
        ORDER BY spt.created_at DESC;
      `;
      const result = await pool.query(query);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 2. POST TERBITKAN SPT
  router.post('/generate', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { nomor_spt, jadwal_id, tgl_spt, penandatangan_id } = req.body;

      const insertSptQuery = `
        INSERT INTO surat_perintah_tugas (nomor_spt, jadwal_id, tgl_spt, penandatangan_id, status_spt)
        VALUES ($1, $2, $3, $4, 'ISSUED') RETURNING *;
      `;
      const sptRes = await client.query(insertSptQuery, [nomor_spt, jadwal_id, tgl_spt, penandatangan_id]);
      const sptData = sptRes.rows[0];

      const insertKkpQuery = `
        INSERT INTO kkp_header (spt_id, status_review)
        VALUES ($1, 'DRAFT_ANGGOTA') RETURNING id;
      `;
      const kkpRes = await client.query(insertKkpQuery, [sptData.id]);

      await client.query('COMMIT');
      res.status(201).json({
        success: true,
        message: 'Surat Perintah Tugas (SPT) berhasil diterbitkan & Wadah KKP Digital telah disiapkan.',
        spt: sptData,
        kkp_id: kkpRes.rows[0].id
      });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  });

  return router;
};