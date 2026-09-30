// =============================================================================
// ROUTES: MODUL DISTRIBUSI LHP RAHASIA & EMERGENCY OVERRIDE
// =============================================================================

const express = require('express');
const router = express.Router();
const axios = require('axios');
const LhpSecurityService = require('../services/lhpSecurity');

module.exports = (pool) => {

  // 1. REQUEST ACCESS / CEK JAM KERJA & KIRIM EMERGENCY KE TELEGRAM
  router.post('/request-access', async (req, res) => {
    try {
      const { lhp_id, opd_id, requested_by, is_emergency, alasan_darurat, nota_dinas } = req.body;
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

      // Cek Jam Kerja via Stored Function SQL
      const checkHoursQuery = `SELECT * FROM validate_working_hours_access_v2($1, NULL);`;
      const checkRes = await pool.query(checkHoursQuery, [is_emergency || false]);
      const accessRule = checkRes.rows[0];

      // Jika di luar jam kerja dan BUKAN pengajuan emergency
      if (!accessRule.is_allowed && !is_emergency) {
        return res.status(403).json({
          success: false,
          code: 'OUTSIDE_WORKING_HOURS',
          message: accessRule.rejection_reason
        });
      }

      // Jika Pengajuan Emergency Override
      if (is_emergency) {
        // Simpan log request emergency
        const insertLog = `
          INSERT INTO lhp_access_logs (lhp_id, opd_id, requested_by, session_token, otp_code_hash, ip_address, user_agent, expires_at)
          VALUES ($1, $2, $3, gen_random_uuid()::varchar, 'HASH_OTP', $4, 'WebBrowser', NOW() + INTERVAL '1 hour')
          RETURNING id;
        `;
        const logRes = await pool.query(insertLog, [lhp_id, opd_id, requested_by, clientIp]);
        const logId = logRes.rows[0].id;

        const insertOverride = `
          INSERT INTO lhp_emergency_overrides (lhp_access_log_id, alasan_darurat, nomor_nota_dinas_dasar, status)
          VALUES ($1, $2, $3, 'PENDING') RETURNING id;
        `;
        const overrideRes = await pool.query(insertOverride, [logId, alasan_darurat, nota_dinas]);
        const overrideId = overrideRes.rows[0].id;

        // Kirim Notifikasi Interaktif ke Bot Telegram Inspektur
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.INSPEKTUR_TELEGRAM_CHAT_ID;

        if (botToken && chatId && botToken !== 'your_bot_token_here') {
          const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
          const messageText = `🚨 *PERMOHONAN AKSES DARURAT LHP*\n\n` +
            `📌 *Nota Dinas:* ${nota_dinas}\n` +
            `📝 *Alasan:* ${alasan_darurat}\n` +
            `🌐 *IP Address:* ${clientIp}\n\n` +
            `Apakah Anda menyetujui akses pengunduhan dokumen rahasia ini di luar jam kerja?`;

          await axios.post(telegramUrl, {
            chat_id: chatId,
            text: messageText,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ SETUJUI', callback_data: `APPROVE_${overrideId}` },
                { text: '❌ TOLAK', callback_data: `REJECT_${overrideId}` }
              ]]
            }
          });
        }

        return res.status(202).json({
          success: true,
          status: 'EMERGENCY_PENDING_APPROVAL',
          message: 'Permohonan darurat telah dikirim ke Telegram Inspektur untuk persetujuan.',
          override_id: overrideId
        });
      }

      res.json({
        success: true,
        message: 'Akses diizinkan. Silakan verifikasi OTP untuk mengunduh.'
      });

    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
};