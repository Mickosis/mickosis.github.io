import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { z } from 'zod';

const ym = z.union([z.string(), z.date()]).transform((v) => (v instanceof Date ? v.toISOString().slice(0, 7) : String(v)));

const Work = z.object({
  name: z.string(),
  position: z.string(),
  location: z.string(),
  startDate: ym,
  endDate: ym.optional(),
  summary: z.string(),
  highlights: z.array(z.string()).min(1),
});

const Resume = z.object({
  basics: z.object({
    name: z.string(),
    label: z.string(),
    email: z.string().email(),
    url: z.string().url(),
    summary: z.string(),
    location: z.object({ city: z.string(), countryCode: z.string(), region: z.string() }),
    profiles: z.array(z.object({ network: z.string(), username: z.string(), url: z.string().url() })),
    phone: z.never().optional(),
  }),
  work: z.array(Work).min(1),
  education: z.array(
    z.object({ institution: z.string(), area: z.string(), studyType: z.string(), startDate: ym, endDate: ym }),
  ),
  certificates: z.array(z.object({ name: z.string(), issuer: z.string(), date: ym })),
  skills: z.array(z.object({ name: z.string(), keywords: z.array(z.string()) })),
  languages: z.array(z.object({ language: z.string(), fluency: z.string() })),
  interests: z.array(z.object({ name: z.string() })),
  projects: z.array(
    z.object({ name: z.string(), startDate: ym, url: z.string().url().optional(), description: z.string() }),
  ),
  'x-results': z.array(z.object({ spec: z.string(), where: z.string(), year: ym })),
  'x-trainings': z.array(z.object({ name: z.string(), issuer: z.string().optional() })),
});

const Repos = z.object({
  owner: z.string(),
  identities: z.array(z.string()).optional(),
  featured: z.array(z.object({ repo: z.string(), title: z.string(), blurb: z.string() })),
  exclude: z.array(z.string()).optional(),
  masked: z.array(z.object({ alias: z.string(), title: z.string(), stack: z.array(z.string()), blurb: z.string() })),
});

const Stats = z.object({
  key: z.string(),
  name: z.string(),
  url: z.string().nullable(),
  description: z.string().nullable(),
  private: z.boolean(),
  fork: z.string().nullable(),
  stars: z.number(),
  forks: z.number(),
  createdAt: z.string(),
  pushedAt: z.string(),
  firstCommitAt: z.string().nullable(),
  commits: z.number(),
  myCommits: z.number(),
  commits90d: z.number(),
  mergedPRs: z.number(),
  releases: z.number(),
  languages: z.record(z.string(), z.number()),
  weekly: z.array(z.number()),
  agentContract: z.boolean(),
  homepage: z.string().nullable(),
});

const GitHub = z.object({
  generatedAt: z.string(),
  owner: z.string(),
  totals: z.object({
    repos: z.number(),
    activeRepos90d: z.number(),
    myCommits: z.number(),
    commits90d: z.number(),
    agentRepos: z.number(),
    stars: z.number(),
  }),
  contributions: z
    .object({
      totalContributions: z.number(),
      commitContributions: z.number(),
      privateContributions: z.number(),
      weekly: z.array(z.number()),
    })
    .nullable(),
  public: z.array(Stats),
  masked: z.array(Stats),
});

export type Stats = z.infer<typeof Stats>;
export type WorkItem = z.infer<typeof Work>;

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

// RESUME_FILE lets /tailor build a one-off variant without touching the source of truth.
export const resume = Resume.parse(loadYaml(read(process.env.RESUME_FILE || 'data/resume.yaml')));
export const repos = Repos.parse(loadYaml(read('data/repos.yaml')));
export const github = GitHub.parse(JSON.parse(read('data/github.json')));

export type Project = {
  kind: 'featured' | 'masked' | 'archive';
  title: string;
  blurb: string;
  stack: string[];
  stats: Stats | null;
};

const topLangs = (s: Stats | null) =>
  s ? Object.entries(s.languages).sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 3) : [];

const byName = new Map(github.public.map((s) => [s.name.toLowerCase(), s]));

export const featured: Project[] = repos.featured.map((f) => {
  const stats = byName.get(f.repo.toLowerCase()) ?? null;
  return { kind: 'featured', title: f.title, blurb: f.blurb, stack: topLangs(stats), stats };
});

export const masked: Project[] = repos.masked
  .map((m) => {
    const stats = github.masked.find((s) => s.key === m.alias) ?? null;
    return { kind: 'masked' as const, title: m.title, blurb: m.blurb, stack: m.stack, stats };
  })
  .sort((a, b) => (b.stats?.pushedAt ?? '').localeCompare(a.stats?.pushedAt ?? ''));

const featuredSet = new Set(repos.featured.map((f) => f.repo.toLowerCase()));
export const archive: Project[] = github.public
  .filter((s) => !featuredSet.has(s.name.toLowerCase()))
  .sort((a, b) => b.pushedAt.localeCompare(a.pushedAt))
  .map((s) => ({ kind: 'archive', title: s.name, blurb: s.description ?? '', stack: topLangs(s), stats: s }));

// ---------- formatting helpers ----------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtYm = (v?: string) => {
  if (!v) return 'now';
  const [y, m] = v.split('-');
  return m ? `${MONTHS[Number(m) - 1]} ${y}` : y;
};
export const fmtDate = (iso: string | null) => (iso ? fmtYm(iso.slice(0, 7)) : '');
export const n = (x: number) => x.toLocaleString('en-US');

const BLOCKS = '▁▂▃▄▅▆▇█';
/** Unicode block sparkline; zero weeks render as the lowest block so the shape stays readable. */
export function sparkline(values: number[], width = 26): string {
  if (!values.length) return '';
  // Bucket to the target width by summing adjacent weeks.
  const size = Math.ceil(values.length / width);
  const buckets: number[] = [];
  for (let i = 0; i < values.length; i += size) buckets.push(values.slice(i, i + size).reduce((a, b) => a + b, 0));
  const max = Math.max(...buckets);
  if (max === 0) return BLOCKS[0].repeat(buckets.length);
  return buckets.map((v) => (v === 0 ? BLOCKS[0] : BLOCKS[Math.max(1, Math.round((v / max) * 7))])).join('');
}

export function langShare(s: Stats | null, limit = 3): { name: string; pct: number }[] {
  if (!s) return [];
  const total = Object.values(s.languages).reduce((a, b) => a + b, 0);
  if (!total) return [];
  return Object.entries(s.languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, v]) => ({ name, pct: Math.round((v / total) * 100) }))
    .filter((l) => l.pct > 0);
}

/** Years and months between a YYYY-MM start and today. */
export function tenure(start: string): string {
  const [y, m] = start.split('-').map(Number);
  const now = new Date();
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - (m || 1));
  const yrs = Math.floor(months / 12);
  months %= 12;
  return `${yrs}y ${months}m`;
}

export const careerStart = resume.work.map((w) => w.startDate).sort()[0];
