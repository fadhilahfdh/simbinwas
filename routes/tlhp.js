// =============================================================================
// ROUTES: MODUL PORTAL TINDAK LANJUT (TLHP) AUDITEE & VERIFIKASI
// =============================================================================

const express = require('express');
const router = express.Router();

module.exports = (pool) => {

  // 1. GET MATRIKS TLHP PER OPD / LHP
  router.get('/obrik/:obrik_id', async (req, res) => {
    try {
      const { obrik_id } = req.params;

      const query = `
        SELECT 
          th.id as tlhp_header_id,
          lh.nomor_lhp,
          lh.tgl_lhp,
          th.total_rekomendasi,
          th.total_nilai_kerugian,
          th.jumlah_sesuai,
          th.jumlah_belum_sesuai,
          th.jumlah_belum_tl,
          th.jumlah_tdt,
          th.status_penyelesaian,
          json_agg(
            json_build_object(
              'rekomendasi_id', td.id,
              'kode_rekomendasi', td.kode_rekomendasi,
              'uraian_rekomendasi', td.uraian_rekomendasi,
              'nilai_rekomendasi_rp', td.nilai_rekomendasi_rp,
              'nilai_setor_realisasi_rp', td.nilai_setor_realisasi_rp,
              'status_tl', td.status_tl,
              'catatan_verifikator', td.catatan_verifikator_terakhir
            )
          ) as detail_rekomendasi
        FROM tlhp_header th
        JOIN lhp_header lh ON th.lhp_id = lh.id
        JOIN tlhp_detail_rekomendasi td ON th.id = td.tlhp_header_id
        WHERE th.obrik_id = $1
        GROUP BY th.id, lh.nomor_lhp, lh.tgl_lhp;
      `;

      const result = await pool.query(query, [obrik_id]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 2. POST SUBMISSION BUKTI SETOR / DOKUMEN OLEH AUDITEE
  router.post('/submit-bukti', async (req, res) => {
    try {
      const { rekomendasi_detail_id, uraian_tindak_lanjut, nilai_setor_diajukan, submitted_by } = req.body;

      const query = `
        INSERT INTO tlhp_submissions (
          rekomendasi_detail_id, 
          uraian_tindak_lanjut, 
          nilai_setor_diajukan, 
          status_submission, 
          submitted_by, 
          submitted_at
        )
        VALUES ($1, $2, $3, 'SUBMITTED', $4, NOW())
        RETURNING *;
      `;

      const result = await pool.query(query, [
        rekomendasi_detail_id,
        uraian_tindak_lanjut,
        nilai_setor_diajukan || 0.00,
        submitted_by
      ]);

      res.status(201).json({
        success: true,
        message: 'Bukti tindak lanjut berhasil diunggah dan menunggu verifikasi APIP.',
        data: result.rows[0]
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 3. PUT VERIFIKASI TLHP OLEH VERIFIKATOR APIP
  // (Mengubah status submission yang secara otomatis memicu Trigger SQL Recalculate)
  router.put('/verifikasi-submission', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { submission_id, status_approval, status_tl_kategori, verified_by, catatan_revisi } = req.body;
      // status_approval: 'VERIFIED_OK' atau 'REJECTED_NEED_REVISION'
      // status_tl_kategori: 'S', 'BS', 'BD', atau 'TDT'

      // Update Submissions
      const updateSubQuery = `
        UPDATE tlhp_submissions
        SET status_submission = $1,
            verified_by = $2,
            verified_at = NOW(),
            catatan_revisi_verifikator = $3
        WHERE id = $4
        RETURNING rekomendasi_detail_id;
      `;
      const subRes = await client.query(updateSubQuery, [
        status_approval,
        verified_by,
        catatan_revisi || null,
        submission_id
      ]);

      if (subRes.rows.length === 0) {
        throw new Error('Data submission tidak ditemukan');
      }

      const rekomDetailId = subRes.rows[0].rekomendasi_detail_id;

      // Update Status Kategori (S/BS/BD/TDT) pada Detail Rekomendasi
      if (status_tl_kategori) {
        const updateRekomQuery = `
          UPDATE tlhp_detail_rekomendasi
          SET status_tl = $1,
              catatan_verifikator_terakhir = $2,
              updated_at = NOW()
          WHERE id = $3;
        `;
        await client.query(updateRekomQuery, [status_tl_kategori, catatan_revisi || null, rekomDetailId]);
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: `Verifikasi berhasil diproses dengan status: ${status_approval}. Progres TLHP dihitung ulang otomatis.`
      });

    } catch (error) {
      await client.query('ROLLBACK');
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  });

  // 4. GET EXECUTIVE DASHBOARD MATERIALIZED VIEW (DASHBOARD BUPATI & INSPEKTUR)
  router.get('/dashboard-eksekutif', async (req, res) => {
    try {
      // Refresh Materialized View terlebih dahulu untuk data paling presisi
      await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY v_dashboard_eksekutif_tlhp;');
      
      const query = `SELECT * FROM v_dashboard_eksekutif_tlhp ORDER BY persentase_kepatuhan DESC;`;
      const result = await pool.query(query);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      // Fallback jika belum pernah di-refresh secara concurrently
      try {
        const fallbackRes = await pool.query('SELECT * FROM v_dashboard_eksekutif_tlhp ORDER BY persentase_kepatuhan DESC;');
        res.json({ success: true, data: fallbackRes.rows });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    }
  });

  return router;
};