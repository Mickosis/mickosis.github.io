/** Renders the /print page of the built site to dist/resume.pdf and fails if it runs past MAX_PAGES. */
import { chromium } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';
import { serve } from './serve';

const MAX_PAGES = 2;
const PORT = 4329;

const server = await serve('dist', PORT);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/print/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const raw = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });

  const resume = JSON.parse(JSON.stringify((await import('../src/lib/data')).resume.basics));
  const doc = await PDFDocument.load(raw);
  doc.setTitle(`${resume.name} - Resume`);
  doc.setAuthor(resume.name);
  doc.setSubject(resume.label);
  doc.setKeywords(['QA', 'Test Automation', 'SDET', 'AI', 'Playwright', 'Appium', 'WebdriverIO']);
  doc.setCreator('mickosis.github.io (Astro + Playwright)');
  const bytes = await doc.save();
  await writeFile('dist/resume.pdf', bytes);

  const pages = doc.getPageCount();
  const meta = JSON.parse(await readFile('dist/build.json', 'utf8').catch(() => '{}'));
  await writeFile('dist/build.json', JSON.stringify({ ...meta, pdfPages: pages }, null, 2));
  console.log(`dist/resume.pdf: ${pages} page(s), ${(bytes.length / 1024).toFixed(0)} KB`);
  if (pages > MAX_PAGES) {
    console.error(`resume.pdf has ${pages} pages; the limit is ${MAX_PAGES}. Trim data/resume.yaml or the print layout.`);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  server.close();
}
