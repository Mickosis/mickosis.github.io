/** Rewrites the generated block in README.md from data/resume.yaml and data/github.json. */
import { readFile, writeFile } from 'node:fs/promises';
import { resume, github, featured, masked, n } from '../src/lib/data';

const START = '<!-- generated:start -->';
const END = '<!-- generated:end -->';
const t = github.totals;

const rows = [...featured, ...masked].map((p) => {
  const s = p.stats;
  const name = p.kind === 'masked' ? `${p.title} *(private)*` : `[${p.title}](${s?.url})`;
  return `| ${name} | ${p.stack.slice(0, 2).join(', ')} | ${s ? n(s.myCommits) : '–'} | ${s ? n(s.commits90d) : '–'} | ${s?.agentContract ? 'yes' : ''} |`;
});

const block = `${START}
**${resume.basics.name}**, ${resume.basics.label}

| | |
|---|---|
| Commits of mine across ${t.repos} repos | **${n(t.myCommits)}** |
| Commits in the last 90 days | **${n(t.commits90d)}** |
| Repos built with coding agents | **${t.agentRepos}** |

| Project | Stack | My commits | Last 90 days | Agent-built |
|---|---|---:|---:|:---:|
${rows.join('\n')}

<sub>Updated ${github.generatedAt.slice(0, 10)} by the weekly workflow.</sub>
${END}`;

const readme = await readFile('README.md', 'utf8');
const a = readme.indexOf(START);
const b = readme.indexOf(END);
if (a < 0 || b < 0) throw new Error('README.md is missing the generated markers');
await writeFile('README.md', readme.slice(0, a) + block + readme.slice(b + END.length));
console.log('README.md updated');
