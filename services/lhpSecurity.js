// =============================================================================
// SERVICE: LHP SECURITY & DYNAMIC WATERMARKING ENGINE
// =============================================================================

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');

class LhpSecurityService {

  /**
   * Menempelkan Watermark Transparan secara On-The-Fly pada setiap halaman PDF LHP
   */
  static async applyDynamicWatermark(pdfBuffer, metadata) {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    const watermarkText = `RAHASIA - DOKUMEN INSPEKTORAT KAB. SERANG | DILINDUNGI UU`;
    const subText = `NIP: ${metadata.nip} | OPD: ${metadata.nama_obrik} | IP: ${metadata.ip_address} | ${metadata.download_time}`;

    pages.forEach((page) => {
      const { width, height } = page.getSize();

      // Watermark Utama (Diagonal Center)
      page.drawText(watermarkText, {
        x: width / 6,
        y: height / 2,
        size: 16,
        font: font,
        color: rgb(0.8, 0.1, 0.1),
        opacity: 0.18,
        rotate: { angle: Math.PI / 6 } // Kemiringan 30 derajat
      });

      // Watermark Detail Metadata (Footer Margin)
      page.drawText(subText, {
        x: 20,
        y: 15,
        size: 8,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
        opacity: 0.5
      });
    });

    return await pdfDoc.save();
  }
}

module.exports = LhpSecurityService;