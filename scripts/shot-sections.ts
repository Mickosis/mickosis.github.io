/** Viewport screenshots of individual sections for close visual review. Usage: tsx scripts/shot-sections.ts <outDir> [desktop|mobile] [dark|light] */
import { chromium, devices } from '@playwright/test';
import { serve } from './serve';
const [out, vp = 'desktop', theme = 'dark'] = process.argv.slice(2);
const server = await serve('dist', 4331);
const b = await chromium.launch();
const opts = vp === 'mobile' ? devices['iPhone 13'] : { viewport: { width: 1440, height: 900 } };
const ctx = await b.newContext({ ...opts, colorScheme: theme as 'dark' | 'light', reducedMotion: 'reduce' });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4331/');
await p.evaluate(() => document.fonts.ready);
for (const id of ['whoami', 'results', 'experience', 'projects', 'skills', 'about', 'build']) {
  await p.locator(`#${id}`).scrollIntoViewIfNeeded();
  await p.evaluate((i) => document.getElementById(i)!.scrollIntoView({ block: 'start' }), id);
  await p.waitForTimeout(150);
  await p.screenshot({ path: `${out}/${vp}-${theme}-${id}.png` });
}
await b.close(); server.close();
