/**
 * Fails when any private repository name shows up in what gets published.
 *
 * Terms come from secrets so they never live in this public repo:
 *   PRIVATE_REPOS      "alias=RepoA+RepoB;alias2=RepoC" (the repo names are the terms)
 *   PRIVATE_BLOCKLIST  extra comma-separated terms (codenames, hostnames, ...)
 */
import { pathToFileURL } from 'node:url';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const TEXT = new Set(['.html', '.json', '.js', '.css', '.txt', '.xml', '.md', '.svg', '.yaml', '.yml']);

export function termsFromEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const repos = (env.PRIVATE_REPOS || '')
    .split(';')
    .flatMap((pair) => (pair.split('=')[1] || '').split('+'))
    .map((s) => s.trim());
  const extra = (env.PRIVATE_BLOCKLIST || '').split(',').map((s) => s.trim());
  // Also catch names written with spaces or dashes instead of the separators used in the repo name.
  const variants = [...repos, ...extra].filter((t) => t.length >= 3).flatMap((t) => [t, t.replace(/[-_]/g, ' '), t.replace(/[-_]/g, '')]);
  return [...new Set(variants.map((t) => t.toLowerCase()))];
}

export function findLeaks(text: string, terms: string[]): string[] {
  const hay = text.toLowerCase();
  return terms.filter((t) => new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(hay));
}

async function* walk(path: string): AsyncGenerator<string> {
  const s = await stat(path).catch(() => null);
  if (!s) return;
  if (s.isFile()) return void (yield path);
  for (const entry of await readdir(path)) yield* walk(join(path, entry));
}

async function main() {
  const terms = termsFromEnv();
  if (!terms.length) {
    console.warn('leak-check: PRIVATE_REPOS / PRIVATE_BLOCKLIST not set, nothing to check against. Skipping.');
    return;
  }
  const targets = ['dist', 'data', 'README.md', 'src', 'tests', 'scripts', '.claude', 'CLAUDE.md', 'AGENTS.md'];
  let hits = 0;
  for (const target of targets) {
    for await (const file of walk(target)) {
      if (!TEXT.has(extname(file)) || file.includes('__screenshots__')) continue;
      const leaks = findLeaks(await readFile(file, 'utf8'), terms);
      if (leaks.length) {
        hits += leaks.length;
        console.error(`LEAK ${file}: ${leaks.length} private term(s) found`);
      }
    }
  }
  if (hits) {
    console.error(`leak-check failed: ${hits} private term(s) would be published.`);
    process.exit(1);
  }
  console.log(`leak-check passed: ${terms.length} terms, no matches.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
