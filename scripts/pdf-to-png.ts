/** Splits dist/resume.pdf into one PNG per page (macOS sips) for visual review. Usage: tsx scripts/pdf-to-png.ts <outDir> */
import { PDFDocument } from 'pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const out = process.argv[2] || 'out';
const src = await PDFDocument.load(await readFile('dist/resume.pdf'));
for (let i = 0; i < src.getPageCount(); i++) {
  const one = await PDFDocument.create();
  const [pg] = await one.copyPages(src, [i]);
  one.addPage(pg);
  const pdf = `${out}/page-${i + 1}.pdf`;
  await writeFile(pdf, await one.save());
  execFileSync('sips', ['-s', 'format', 'png', '-Z', '1600', pdf, '--out', `${out}/page-${i + 1}.png`], { stdio: 'ignore' });
  console.log(`${out}/page-${i + 1}.png`);
}
