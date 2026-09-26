import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

test.describe('resume.pdf', () => {

  test('is at most two A4 pages with metadata', async ({ request }) => {
    const res = await request.get('/resume.pdf');
    expect(res.ok()).toBe(true);
    const doc = await PDFDocument.load(await res.body());
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getPageCount()).toBeLessThanOrEqual(2);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
    expect(doc.getTitle()).toContain('Miguel Carlo Rigunay');
  });

  test('print page fits its content without clipping', async ({ page }) => {
    await page.goto('/print/');
    await page.emulateMedia({ media: 'print' });
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('.page *')].filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible').length,
    );
    expect(overflow).toBe(0);
    await expect(page.locator('.js-email')).toHaveAttribute('href', /^mailto:/);
  });
});
