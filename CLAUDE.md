# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- Slash commands for common jobs live in `.claude/commands/`:
  - `/update-resume <notes or pasted LinkedIn text>` updates `data/resume.yaml`, runs the gates and opens a PR.
  - `/refresh-projects` rewrites featured and masked project blurbs from current READMEs and commits.
  - `/tailor <job description>` builds a tailored PDF in `out/`. It is never committed or deployed.
- Use `gh` for GitHub data. Private repos may be read for context, but what you learn from them must stay generic in anything written here (see hard rule 2).
- Before finishing UI or PDF work, render the screenshots and PDF pages and look at them. Tests passing is not the same as looking right.
