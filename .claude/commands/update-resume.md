---
description: Update resume content from notes or pasted LinkedIn text, verify, and open a PR
argument-hint: <notes, a new role, or pasted LinkedIn sections>
---

Update `data/resume.yaml` using this input:

$ARGUMENTS

Steps:
1. Read `AGENTS.md` and `data/resume.yaml`. Work out what changed: a new role, new bullets, new certificates, new skills or corrected dates. LinkedIn wording wins over older content.
2. Edit `data/resume.yaml` only. Follow the copy rules: active voice, quantified where the input gives numbers, nothing invented. If a fact is missing (a date, a metric), ask instead of guessing.
3. If a result is strong and measurable, add it to `x-results` as a short spec line ("cuts X from A to B").
4. Create a branch `content/<short-slug>`.
5. Run `npm run build`. If the PDF goes over 2 pages, trim the oldest role bullets or lower-value lines until it fits, and tell the user what you trimmed.
6. Run `npx tsx scripts/pdf-to-png.ts out` and look at each page. Fix awkward breaks.
7. Run `npm test`. For intentional layout changes, update the snapshots with `npx playwright test --update-snapshots` and look at the new images.
8. Commit with `content: <summary>`, push, and open a PR with `gh pr create`. The body should summarize the changes and include the PDF page count.
