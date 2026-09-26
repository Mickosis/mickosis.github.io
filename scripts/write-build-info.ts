/** Writes dist/build.json (commit, run link, test and PDF results) that the "build" section reads at runtime. */
import { readFile, writeFile } from 'node:fs/promises';

const results = JSON.parse(await readFile('test-results/results.json', 'utf8').catch(() => 'null'));
const stats = results?.stats;
const meta = JSON.parse(await readFile('dist/build.json', 'utf8').catch(() => '{}'));
const repo = process.env.GITHUB_REPOSITORY;
const run = process.env.GITHUB_RUN_ID;

const info = {
  ...meta,
  builtAt: new Date().toISOString(),
  sha: process.env.GITHUB_SHA ?? null,
  runUrl: repo && run ? `https://github.com/${repo}/actions/runs/${run}` : null,
  tests: stats ? { passed: stats.expected + (stats.flaky ?? 0), total: stats.expected + stats.unexpected + (stats.flaky ?? 0), skipped: stats.skipped } : null,
};
await writeFile('dist/build.json', JSON.stringify(info, null, 2));
console.log('dist/build.json', info);
