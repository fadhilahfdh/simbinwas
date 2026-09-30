// =============================================================================
// ROUTES: MODUL KKP DIGITAL & NOTISI TEMUAN AUDIT (NHP)
// =============================================================================

const express = require('express');
const router = express.Router();

module.exports = (pool) => {

  // 1. GET DETAIL KKP BERDASARKAN ID
  router.get('/:kkp_id', async (req, res) => {
    try {
      const { kkp_id } = req.params;
      
      // Ambil Header KKP & Data SPT
      const kkpQuery = `
        SELECT 
          kh.id as kkp_id,
          kh.status_review,
          spt.nomor_spt,
          spt.tgl_spt,
          ob.nama_obrik
        FROM kkp_header kh
        JOIN surat_perintah_tugas spt ON kh.spt_id = spt.id
        JOIN penugasan_jadwal pj ON spt.jadwal_id = pj.id
        JOIN pkpt_detail_kegiatan pd ON pj.pkpt_detail_id = pd.id
        JOIN master_obrik ob ON pd.obrik_id = ob.id
        WHERE kh.id = $1;
      `;
      const kkpRes = await pool.query(kkpQuery, [kkp_id]);

      if (kkpRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Data KKP tidak ditemukan' });
      }

      // Ambil List PKA (Program Kerja Audit)
      const pkaQuery = `SELECT * FROM kkp_detail_pka WHERE kkp_header_id = $1 ORDER BY kode_pka ASC;`;
      const pkaRes = await pool.query(pkaQuery, [kkp_id]);

      // Ambil Notisi Temuan Audit
      const temuanQuery = `
        SELECT 
          nt.*,
          json_agg(nr.*) FILTER (WHERE nr.id IS NOT NULL) as rekomendasi
        FROM notisi_temuan nt
        LEFT JOIN notisi_rekomendasi nr ON nt.id = nr.notisi_temuan_id
        WHERE nt.kkp_header_id = $1
        GROUP BY nt.id;
      `;
      const temuanRes = await pool.query(temuanQuery, [kkp_id]);

      res.json({
        success: true,
        data: {
          header: kkpRes.rows[0],
          pka_list: pkaRes.rows,
          temuan_list: temuanRes.rows
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 2. POST AMBILI / UPDATE PROSEDUR PKA
  router.post('/pka', async (req, res) => {
    try {
      const { kkp_header_id, kode_pka, uraian_prosedur, hasil_pengujian, pelaksana_id, status_pka } = req.body;
      const query = `
        INSERT INTO kkp_detail_pka (kkp_header_id, kode_pka, uraian_prosedur, hasil_pengujian, pelaksana_id, status_pka)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      const result = await pool.query(query, [
        kkp_header_id,
        kode_pka,
        uraian_prosedur,
        hasil_pengujian || null,
        pelaksana_id || null,
        status_pka || 'PENDING'
      ]);
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 3. POST TAMBAH TEMUAN 5 UNSUR (Kondisi, Kriteria, Sebab, Akibat, Rekomendasi)
  router.post('/temuan', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { kkp_header_id, kondisi, kriteria, sebab, akibat, kategori_temuan, rekomendasi_list } = req.body;

      // Insert 4 Unsur Temuan
      const temuanQuery = `
        INSERT INTO notisi_temuan (kkp_header_id, kondisi, kriteria, sebab, akibat, kategori_temuan)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;
      `;
      const temuanRes = await client.query(temuanQuery, [
        kkp_header_id, kondisi, kriteria, sebab, akibat, kategori_temuan || 'KEPATUHAN'
      ]);
      const temuanId = temuanRes.rows[0].id;

      // Insert Rekomendasi
      const addedRekomendasi = [];
      if (rekomendasi_list && rekomendasi_list.length > 0) {
        const rekomQuery = `
          INSERT INTO notisi_rekomendasi (notisi_temuan_id, kode_rekomendasi, uraian_rekomendasi, nilai_rekomendasi_rp)
          VALUES ($1, $2, $3, $4) RETURNING *;
        `;
        for (const rekom of rekomendasi_list) {
          const rekomRes = await client.query(rekomQuery, [
            temuanId,
            rekom.kode_rekomendasi,
            rekom.uraian_rekomendasi,
            rekom.nilai_rekomendasi_rp || 0.00
          ]);
          addedRekomendasi.push(rekomRes.rows[0]);
        }
      }

      await client.query('COMMIT');
      res.status(201).json({
        success: true,
        message: 'Notisi Temuan 5 Unsur berhasil dicatat.',
        temuan_id: temuanId,
        rekomendasi: addedRekomendasi
      });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  });

  // 4. PUT UPDATE STATUS REVIEW BERJENJANG KKP
  router.put('/review-status', async (req, res) => {
    try {
      const { kkp_header_id, target_status } = req.body;
      // Validasi Status Standard APIP
      const validStatuses = ['DRAFT_ANGGOTA', 'REVIEW_KETUA_TIM', 'REVIEW_SUPERVISOR', 'APPROVED'];
      
      if (!validStatuses.includes(target_status)) {
        return res.status(400).json({ success: false, message: 'Status review tidak valid' });
      }

      const query = `UPDATE kkp_header SET status_review = $1 WHERE id = $2 RETURNING *;`;
      const result = await pool.query(query, [target_status, kkp_header_id]);

      res.json({
        success: true,
        message: `Status KKP berhasil diperbarui ke: ${target_status}`,
        data: result.rows[0]
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
};