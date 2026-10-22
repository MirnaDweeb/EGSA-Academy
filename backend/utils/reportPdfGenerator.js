const PDFDocument = require('pdfkit');

async function generateAnalyticsReportPdfBuffer({
  reportTitle = 'Academy Analytics Report',
  reportType = 'overview',
  division = 'all',
  filters = {},
  kpiCards = [],
  headers = [],
  rows = [],
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Header
      doc.fillColor('#3A6985').fontSize(18).text('Egyptian Space Agency — Academy Platform', { align: 'center' });
      doc.moveDown(0.5);
      doc.fillColor('#1E7C85').fontSize(14).text(reportTitle, { align: 'center' });
      doc.moveDown(0.3);
      doc.fillColor('#666666').fontSize(9).text(`Generated: ${new Date().toISOString()} | Division: ${division} | Type: ${reportType}`, { align: 'center' });
      doc.moveDown(1);

      // KPI Cards
      if (kpiCards && kpiCards.length > 0) {
        doc.fillColor('#3A6985').fontSize(12).text('Key Metrics:');
        doc.moveDown(0.3);
        kpiCards.forEach((kpi) => {
          doc.fillColor('#222222').fontSize(10).text(`• ${kpi.title || kpi.label || 'Metric'}: ${kpi.value || 0}`);
        });
        doc.moveDown(1);
      }

      // Table Header & Rows
      if (headers && headers.length > 0 && rows && rows.length > 0) {
        doc.fillColor('#3A6985').fontSize(11).text('Report Data:');
        doc.moveDown(0.3);
        doc.fillColor('#444444').fontSize(8).text(headers.join(' | '));
        doc.moveDown(0.2);
        rows.slice(0, 50).forEach((row) => {
          const rowText = Array.isArray(row) ? row.join(' | ') : Object.values(row).join(' | ');
          doc.fillColor('#333333').fontSize(8).text(rowText);
        });
        if (rows.length > 50) {
          doc.moveDown(0.5);
          doc.fillColor('#888888').fontSize(8).text(`... and ${rows.length - 50} more records.`);
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateAnalyticsReportPdfBuffer,
};
