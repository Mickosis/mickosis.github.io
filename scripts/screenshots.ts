/** Full-page screenshots of the built site (desktop + mobile, both themes) for visual review. Usage: tsx scripts/screenshots.ts <outDir> */
import { chromium, devices } from '@playwright/test';
import { serve } from './serve';
const out = process.argv[2];
const server = await serve('dist', 4330);
const b = await chromium.launch();
for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['mobile', devices['iPhone 13']]] as const) {
  for (const theme of ['dark', 'light']) {
    const ctx = await b.newContext({ ...opts, colorScheme: theme as any, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:4330/');
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: `${out}/${name}-${theme}.png`, fullPage: true });
    const sw = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    console.log(name, theme, 'scrollWidth/innerWidth', sw);
    await ctx.close();
  }
}
await b.close(); server.close();
