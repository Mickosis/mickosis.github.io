---
description: Build a resume PDF tailored to a job description (local only, never deployed)
argument-hint: <job description text or URL>
---

Tailor the resume for this role:

$ARGUMENTS

1. Read the job description. Pull out the must-have skills, keywords the ATS will scan for, seniority signals and domain.
2. Copy `data/resume.yaml` to `out/<company>-<role>.yaml` (the `out/` folder is gitignored). In the copy only:
   - reorder `work[].highlights` and `x-results` so the most relevant items come first
   - rephrase bullets to mirror the JD's vocabulary where it is **truthful** to the original. Never add skills, tools or metrics the source does not support
   - reorder `skills` to lead with what the JD asks for
   - optionally sharpen `basics.summary` for the role in 2 to 3 sentences
3. Build: `RESUME_FILE=out/<company>-<role>.yaml npm run build`, then `cp dist/resume.pdf out/<company>-<role>.pdf`.
4. Rebuild the normal site with `npm run build` so `dist/` matches `data/resume.yaml` again.
5. Render `npx tsx scripts/pdf-to-png.ts out` and check the layout (2 pages at most).
6. Report:
   - the PDF path
   - a short list of what changed and why
   - which JD requirements the resume covers well
   - which requirements it doesn't cover, so the user can decide whether to add real experience
