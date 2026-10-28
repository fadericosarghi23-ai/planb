/**
 * Schermate del sito per il PDF di consegna (docs/img/*.jpg).
 *
 *   npm run build && npx astro preview --port 4899   (in un altro terminale)
 *   node scripts/shot-doc.mjs
 *
 * Chrome vero (chrome-launcher + puppeteer-core). Le animazioni d'ingresso sono spente
 * (prefers-reduced-motion) così ogni schermata è già composta.
 */
import { launch } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:4899';
const OUT = (f) => path.resolve('docs/img', f);
mkdirSync(path.resolve('docs/img'), { recursive: true });

const chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox', '--hide-scrollbars', '--enable-unsafe-swiftshader'] });
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });

async function shot(url, file, { w = 1440, h = 900, dsf = 1.5, scroll = 0, sel = null, attesa = 1500, prima = null } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dsf, isMobile: w < 760, hasTouch: w < 760 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => i.setAttribute('loading', 'eager')));
  if (prima) await page.evaluate(prima);
  if (sel) await page.evaluate((s, off) => { const el = document.querySelector(s); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - off); }, sel, scroll);
  else if (scroll) await page.evaluate((y) => window.scrollTo(0, y), scroll);
  await page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; }))));
  await new Promise((r) => setTimeout(r, attesa));
  await page.screenshot({ path: OUT(file), type: 'jpeg', quality: 82 });
  console.log('scritto', file);
  await page.close();
}

try {
  await shot('/', 'home.jpg', { attesa: 6000 });
  await shot('/interiors', 'interni.jpg', { sel: '.pg-gal', scroll: 260 });
  await shot('/products', 'prodotti.jpg', { sel: '.pg-gal', scroll: 220 });
  await shot('/shop', 'shop.jpg', { sel: '.shop', scroll: 150 });
  await shot('/contact', 'contatti.jpg');
  await shot('/', 'home-mobile.jpg', { w: 390, h: 844, dsf: 2 });
  await shot('/interiors', 'interni-mobile.jpg', { w: 390, h: 844, dsf: 2, sel: '.pg-gal', scroll: 120 });
  await shot('/shop', 'shop-mobile.jpg', { w: 390, h: 844, dsf: 2, sel: '.shop', scroll: 110 });
} finally {
  await browser.disconnect();
  try { await chrome.kill(); } catch { /* cartella temporanea di Chrome su Windows */ }
}
