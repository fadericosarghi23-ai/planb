/**
 * Stampa docs/palette-e-interventi.html in PDF con Chrome vero.
 *
 *   node scripts/shot-doc.mjs   (prima, per aggiornare le schermate in docs/img)
 *   node scripts/pdf-doc.mjs
 */
import { launch } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SORGENTE = path.resolve('docs/palette-e-interventi.html');
const USCITA = path.resolve('docs/palette-e-interventi.pdf');

const chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
try {
  const page = (await browser.pages())[0] ?? (await browser.newPage());
  await page.goto(pathToFileURL(SORGENTE).href, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: USCITA, format: 'A4', printBackground: true, preferCSSPageSize: true });
  console.log('PDF scritto in', USCITA);
} finally {
  await browser.disconnect();
  try { await chrome.kill(); } catch { /* cartella temporanea di Chrome su Windows */ }
}
