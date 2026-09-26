import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

const resume = load(readFileSync('data/resume.yaml', 'utf8')) as any;
const sections = ['whoami', 'results', 'experience', 'projects', 'skills', 'about', 'build'];

test.describe('profile page', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('renders every section with real content', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText(resume.basics.name);
    await expect(page.getByText(resume.basics.label).first()).toBeVisible();
    for (const id of sections) await expect(page.locator(`#${id}`)).toBeAttached();
    await expect(page.locator('#experience .commit')).toHaveCount(resume.work.length);
    await expect(page.locator('#results .specs li')).toHaveCount(resume['x-results'].length);
    await expect(page.locator('#projects [data-kind="featured"]').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/\bTODO\b|lorem ipsum|\bundefined\b|\bNaN\b/);
    expect(errors).toEqual([]);
  });

  test('lists each repository only once', async ({ page }) => {
    await page.goto('/');
    const hrefs = await page.locator('#projects a, #about a').evaluateAll((as) =>
      as.map((a) => (a as HTMLAnchorElement).href.toLowerCase().replace(/\/$/, '')).filter((h) => /github\.com\/mickosis\/[^/]+$/.test(h)),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.filter((h, i) => hrefs.indexOf(h) !== i)).toEqual([]);
  });

  test('has no horizontal scroll', async ({ page }) => {
    await page.goto('/');
    const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(scroll).toBeLessThanOrEqual(inner);
  });

  test('section tabs jump to their section', async ({ page }) => {
    await page.goto('/');
    await page.locator('.tab[data-tab="projects"]').click();
    await expect(page.locator('#projects-h')).toBeInViewport();
    await expect(page).toHaveURL(/#projects$/);
  });

  test('theme toggle switches and persists', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.locator('[data-theme-toggle]').click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'light');
  });

  test('follows the OS light preference on first visit', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('email link is assembled in the browser', async ({ page }) => {
    await page.goto('/');
    const mail = page.locator('#contact a.js-email');
    await expect(mail).toHaveAttribute('href', `mailto:${resume.basics.email}`);
    const raw = await (await page.request.get('/')).text();
    expect(raw).not.toContain(resume.basics.email);
  });

  test('never shows a phone number', async ({ page }) => {
    for (const path of ['/', '/print/']) {
      await page.goto(path);
      await expect(page.locator('body')).not.toContainText(/\+\d{1,3}[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3,4}|\b09\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/);
    }
  });

  test('private projects have no names or links', async ({ page }) => {
    await page.goto('/');
    const masked = page.locator('[data-kind="masked"]');
    expect(await masked.count()).toBeGreaterThan(0);
    await expect(masked.locator('a')).toHaveCount(0);
    await expect(masked.first()).toContainText('[private]');
  });

  test('resume.pdf downloads from the header button', async ({ page }) => {
    await page.goto('/');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-pdf').click()]);
    expect(download.suggestedFilename()).toBe('Miguel-Carlo-Rigunay-Resume.pdf');
    const res = await page.request.get('/resume.pdf');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');
    expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
  });
});

test.describe('visual', () => {
  for (const theme of ['dark', 'light'] as const) {
    test(`hero and experience look right (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      // Stats change weekly, so the numbers are masked; layout and type are what is compared.
      const mask = [page.locator('.shortlog'), page.locator('.summary-line')];
      await expect(page).toHaveScreenshot(`hero-${theme}.png`, { mask });
      await expect(page.locator('#experience')).toHaveScreenshot(`experience-${theme}.png`);
    });
  }
});
