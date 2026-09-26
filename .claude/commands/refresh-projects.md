---
description: Rewrite featured and masked project blurbs from current READMEs and commit history
---

Refresh the project descriptions in `data/repos.yaml`.

1. Run `npm run fetch:github` (needs `GITHUB_TOKEN`, and `PRIVATE_REPOS` in env for masked repos) so the stats are current.
2. For each **featured** repo, read its README and recent commits with `gh api`. Rewrite `blurb` in 1 to 3 sentences (at most about 260 characters). Say what it is, what is notable, and how it is built (CI, agents, tests). Use plain words and no hype.
3. For each **masked** entry, you may read the private repo for context, but the blurb must stay generic:
   - no repo name, codename, product name, server name, URL or distinctive identifier
   - describe the category of work and the engineering approach only

   Keep `title` generic too.
4. Suggest (don't apply) changes to the `featured` list if a public repo has become more notable than one already featured. Consider activity, stars and relevance to QA/automation/AI.
5. Run `npm run build && npm test && npm run leak-check`, then look at the projects section in `npx tsx scripts/screenshots.ts out`.
6. Branch `content/refresh-projects-<date>`, commit `content: refresh project blurbs`, open a PR.
