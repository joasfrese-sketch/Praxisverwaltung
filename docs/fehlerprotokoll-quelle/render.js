// Rendert cover.html (ohne Kopf-/Fußzeile) und index.html (mit) zu PDF; danach: pdfunite
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const dir = __dirname;
  const out = process.argv[2] || path.join(dir, '..', 'Probleme-und-Loesungen.pdf');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.join(dir, 'cover.html'), { waitUntil: 'load' });
  await page.pdf({ path: path.join(dir, 'cover.pdf'), format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await page.goto('file://' + path.join(dir, 'index.html'), { waitUntil: 'load' });
  const hf = (l, r) => `<div style="width:100%;font-family:Inter,Arial,sans-serif;font-size:7.5pt;color:#64748b;padding:0 16mm;display:flex;justify-content:space-between">${l}<span>${r}</span></div>`;
  await page.pdf({
    path: path.join(dir, 'body.pdf'), format: 'A4', printBackground: true, displayHeaderFooter: true,
    margin: { top: '20mm', bottom: '18mm', left: '16mm', right: '16mm' },
    headerTemplate: hf('<span>Fehlerprotokoll – Projekt Praxisverwaltung</span>', 'Stand 18.11.2026'),
    footerTemplate: hf('<span>Aus Fehlern lernen · mit KI-Unterstützung erstellt</span>', 'Seite <span class="pageNumber"></span> von <span class="totalPages"></span>'),
  });
  await browser.close();
  console.log('ok', out);
})();
