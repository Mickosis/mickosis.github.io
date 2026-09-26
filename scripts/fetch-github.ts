/**
 * Fetches repository and contribution stats from the GitHub API into data/github.json.
 *
 * Tokens:
 *   GH_STATS_TOKEN  fine-grained PAT with read access to the private repos (optional)
 *   GITHUB_TOKEN    default token for public data (falls back to GH_STATS_TOKEN)
 *
 * Private repos are resolved from PRIVATE_REPOS ("alias=RepoA+RepoB;alias2=RepoC").
 * Only the alias is ever written to disk. When a private repo cannot be read,
 * the previous numbers for that alias are kept.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { load as loadYaml } from 'js-yaml';

type RepoCfg = {
  owner: string;
  identities?: string[];
  featured: { repo: string; title: string; blurb: string }[];
  exclude?: string[];
  masked: { alias: string; title: string; stack: string[]; blurb: string }[];
};

export type RepoStats = {
  key: string;
  name: string;
  url: string | null;
  description: string | null;
  private: boolean;
  fork: string | null;
  stars: number;
  forks: number;
  createdAt: string;
  pushedAt: string;
  firstCommitAt: string | null;
  commits: number;
  myCommits: number;
  commits90d: number;
  mergedPRs: number;
  releases: number;
  languages: Record<string, number>;
  weekly: number[];
  agentContract: boolean;
  homepage: string | null;
};

const API = 'https://api.github.com';
const cfg = loadYaml(readFileSync('data/repos.yaml', 'utf8')) as RepoCfg;
const OUT = 'data/github.json';
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;

const publicToken = process.env.GITHUB_TOKEN || process.env.GH_STATS_TOKEN || '';
const privateToken = process.env.GH_STATS_TOKEN || process.env.GITHUB_TOKEN || '';

const since90 = new Date(Date.now() - 90 * 864e5).toISOString();

async function gh(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(path.startsWith('http') ? path : API + path, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });
    if (res.status === 403 || res.status === 429) {
      const reset = Number(res.headers.get('x-ratelimit-reset') || 0) * 1000;
      const wait = Math.min(Math.max(reset - Date.now(), 2000), 60_000);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  throw new Error(`GitHub API kept rate limiting: ${path}`);
}

async function json<T>(path: string, token: string): Promise<T | null> {
  const res = await gh(path, token);
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** Counts items of a paginated list using per_page=1 and the Link header. */
async function count(path: string, token: string): Promise<number> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await gh(`${path}${sep}per_page=1`, token);
  if (!res.ok) return 0;
  const link = res.headers.get('link');
  const m = link?.match(/[?&]page=(\d+)>; rel="last"/);
  if (m) return Number(m[1]);
  const body = await res.json();
  return Array.isArray(body) ? body.length : 0;
}

async function firstCommitDate(full: string, token: string): Promise<string | null> {
  const res = await gh(`/repos/${full}/commits?per_page=1`, token);
  if (!res.ok) return null;
  const m = res.headers.get('link')?.match(/<([^>]+)>; rel="last"/);
  const target = m ? await json<any[]>(m[1], token) : await res.json();
  return target?.[0]?.commit?.author?.date ?? null;
}

/** 52 weekly commit totals. /stats endpoints answer 202 while GitHub computes them. */
async function weekly(full: string, token: string): Promise<number[]> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await gh(`/repos/${full}/stats/commit_activity`, token);
    if (res.status === 202) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) return [];
    const body = (await res.json()) as { total: number }[];
    return Array.isArray(body) ? body.map((w) => w.total) : [];
  }
  return [];
}

async function hasAgentContract(full: string, token: string): Promise<boolean> {
  for (const p of ['AGENTS.md', 'CLAUDE.md', '.claude']) {
    const res = await gh(`/repos/${full}/contents/${p}`, token);
    if (res.ok) return true;
  }
  return false;
}

const identities = new Set([cfg.owner, ...(cfg.identities ?? [])].map((s) => s.toLowerCase()));

/** Commits by the owner on the default branch, counting unlinked commit identities too. */
async function ownCommits(full: string, token: string): Promise<number> {
  let total = 0;
  for (let page = 1; page <= 10; page++) {
    const list = await json<any[]>(`/repos/${full}/contributors?anon=1&per_page=100&page=${page}`, token);
    if (!list?.length) break;
    for (const c of list) {
      const who = String(c.login ?? c.name ?? '').toLowerCase();
      if (identities.has(who)) total += c.contributions;
    }
    if (list.length < 100) break;
  }
  return total;
}

async function mergedPRs(full: string, token: string): Promise<number> {
  const q = encodeURIComponent(`repo:${full} is:pr is:merged`);
  const body = await json<{ total_count: number }>(`/search/issues?q=${q}&per_page=1`, token);
  return body?.total_count ?? 0;
}

async function repoStats(full: string, token: string): Promise<RepoStats | null> {
  const repo = await json<any>(`/repos/${full}`, token);
  if (!repo) return null;
  const [commits, myCommits, commits90d, prs, releases, languages, week, agent, first] = await Promise.all([
    count(`/repos/${full}/commits`, token),
    ownCommits(full, token),
    count(`/repos/${full}/commits?since=${since90}`, token),
    mergedPRs(full, token),
    count(`/repos/${full}/releases`, token),
    json<Record<string, number>>(`/repos/${full}/languages`, token),
    weekly(full, token),
    hasAgentContract(full, token),
    firstCommitDate(full, token),
  ]);
  return {
    key: repo.name,
    name: repo.name,
    url: repo.html_url,
    description: repo.description,
    private: repo.private,
    fork: repo.fork ? (repo.parent?.full_name ?? 'upstream') : null,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    createdAt: repo.created_at,
    pushedAt: repo.pushed_at,
    firstCommitAt: first,
    commits,
    myCommits,
    commits90d,
    mergedPRs: prs,
    releases,
    languages: languages ?? {},
    weekly: week,
    agentContract: agent,
    homepage: repo.homepage || (repo.has_pages ? `https://${cfg.owner.toLowerCase()}.github.io/${repo.name}/` : null),
  };
}

/** Sums several private repos into one alias-keyed entry with no identifying fields. */
function combine(alias: string, parts: RepoStats[]): RepoStats {
  const langs: Record<string, number> = {};
  const weeks: number[] = [];
  for (const p of parts) {
    for (const [k, v] of Object.entries(p.languages)) langs[k] = (langs[k] || 0) + v;
    p.weekly.forEach((w, i) => (weeks[i] = (weeks[i] || 0) + w));
  }
  const min = (xs: (string | null)[]) => xs.filter(Boolean).sort()[0] ?? null;
  const max = (xs: string[]) => xs.sort().at(-1)!;
  return {
    key: alias,
    name: alias,
    url: null,
    description: null,
    private: true,
    fork: null,
    stars: 0,
    forks: 0,
    createdAt: min(parts.map((p) => p.createdAt))!,
    pushedAt: max(parts.map((p) => p.pushedAt)),
    firstCommitAt: min(parts.map((p) => p.firstCommitAt)),
    commits: parts.reduce((a, p) => a + p.commits, 0),
    myCommits: parts.reduce((a, p) => a + p.myCommits, 0),
    commits90d: parts.reduce((a, p) => a + p.commits90d, 0),
    mergedPRs: parts.reduce((a, p) => a + p.mergedPRs, 0),
    releases: parts.reduce((a, p) => a + p.releases, 0),
    languages: langs,
    weekly: weeks,
    agentContract: parts.some((p) => p.agentContract),
    homepage: null,
  };
}

async function contributions(login: string, token: string) {
  if (!token) return null;
  const query = `query($login:String!){user(login:$login){contributionsCollection{
    totalCommitContributions restrictedContributionsCount
    contributionCalendar{totalContributions weeks{contributionDays{contributionCount}}}}}}`;
  const res = await gh('/graphql', token, {
    method: 'POST',
    body: JSON.stringify({ query, variables: { login } }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as any;
  const c = body?.data?.user?.contributionsCollection;
  if (!c) return null;
  return {
    totalContributions: c.contributionCalendar.totalContributions as number,
    commitContributions: c.totalCommitContributions as number,
    privateContributions: c.restrictedContributionsCount as number,
    weekly: c.contributionCalendar.weeks.map((w: any) =>
      w.contributionDays.reduce((a: number, d: any) => a + d.contributionCount, 0),
    ) as number[],
  };
}

function parsePrivateMap(raw: string | undefined): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const pair of (raw || '').split(';').map((s) => s.trim()).filter(Boolean)) {
    const [alias, repos] = pair.split('=');
    if (alias && repos) map[alias.trim()] = repos.split('+').map((r) => r.trim()).filter(Boolean);
  }
  return map;
}

async function main() {
  const login = cfg.owner;
  const all = (await json<any[]>(`/users/${login}/repos?per_page=100&type=owner&sort=pushed`, publicToken)) ?? [];
  const exclude = new Set((cfg.exclude ?? []).map((s) => s.toLowerCase()));
  const featured = new Set(cfg.featured.map((f) => f.repo.toLowerCase()));
  const publicNames = all
    .filter((r) => !r.private && !exclude.has(r.name.toLowerCase()))
    .map((r) => r.name as string);

  const publicRepos: RepoStats[] = [];
  for (const name of publicNames) {
    const s = await repoStats(`${login}/${name}`, publicToken);
    // Forks only count when they carry the owner's own work.
    if (s && (!s.fork || s.myCommits > 0 || featured.has(name.toLowerCase()))) publicRepos.push(s);
    process.stdout.write('.');
  }

  const privateMap = parsePrivateMap(process.env.PRIVATE_REPOS);
  const masked: RepoStats[] = [];
  for (const m of cfg.masked) {
    const names = privateMap[m.alias] ?? [];
    const parts: RepoStats[] = [];
    for (const n of names) {
      const s = await repoStats(`${login}/${n}`, privateToken);
      if (s) parts.push(s);
    }
    if (parts.length === names.length && parts.length > 0) {
      masked.push(combine(m.alias, parts));
    } else {
      const prev = previous?.masked?.find((p: RepoStats) => p.key === m.alias);
      if (prev) masked.push(prev);
      console.warn(`\nmasked "${m.alias}": no fresh data, ${prev ? 'kept previous numbers' : 'omitted'}`);
    }
    process.stdout.write('.');
  }

  const contrib = (await contributions(login, privateToken || publicToken)) ?? previous?.contributions ?? null;

  const everything = [...publicRepos, ...masked];
  const out = {
    generatedAt: new Date().toISOString(),
    owner: login,
    totals: {
      repos: everything.length,
      activeRepos90d: everything.filter((r) => r.commits90d > 0).length,
      myCommits: everything.reduce((a, r) => a + r.myCommits, 0),
      commits90d: everything.reduce((a, r) => a + r.commits90d, 0),
      agentRepos: everything.filter((r) => r.agentContract).length,
      stars: everything.reduce((a, r) => a + r.stars, 0),
    },
    contributions: contrib,
    public: publicRepos,
    masked,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`\nwrote ${OUT}: ${publicRepos.length} public, ${masked.length} masked`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
