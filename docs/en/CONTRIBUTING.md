# Contributing

Thanks for your interest in contributing! Please read this guide before you start.

## Philosophy
- Prioritize simplicity, readability, and cross‑platform safety.
- Avoid adding runtime dependencies; prefer Node built‑ins and standard APIs.

## Workflow
1. Open an issue for proposals/bugs or pick a labeled task (`good first issue`, `help wanted`).
2. Fork and create a feature branch: `feature/<summary>` or `fix/<summary>`.
3. Keep changes small and focused. Use Conventional Commits (below).
4. Complete the manual verification checklist (below).
5. Open a PR describing motivation, approach, and manual verification results.

## Conventional Commits
- Format: `type: description`
- Examples:
  - `feat: add --lang default resolution`
  - `fix: guard against detached HEAD without name/email`
  - `docs: clarify troubleshooting examples`

## Branch Strategy
- Prefer `feature/*`, `fix/*`, `docs/*`.
- Rebase to keep history clean; prefer squash merge for PRs.

## Scripts
- `npm run build`: build TypeScript output (`dist/`)
- `npm run dev`: run compiled CLI in dry‑run mode (no file writes)
- `npm run start`: run with file output enabled
- `npm run clean`: remove `dist/` for a fresh build

## Code Style
- ESM, Node 18+. Import Node built‑ins with `node:` specifiers.
- Two‑space indentation; camelCase for vars/functions; PascalCase for types.
- Small, side‑effect‑free modules. Add explicit types for public surfaces.

## Security & Privacy
- Never hardcode API keys. Use `OPENROUTER_API_KEY` or `--openrouter-key`.
- Commit metadata and diffs (possibly trimmed) are sent to an LLM provider. Avoid using on sensitive repositories.

## Manual Verification Checklist
1. `npm run build` succeeds
2. In a real Git repo, run:
   ```bash
   OPENROUTER_API_KEY=YOUR_KEY npx donelist --dry-run
   ```
   - First run: `done-list/YYYY-MM-DD.md` is created
   - Subsequent same‑day run: an "Additional updates (HH:mm)" section is appended
3. Sanity‑check flags: `--lang`, `--model`, `--author`, `--author-email`, `--since/--until`, `--verbose`
4. Confirm process/args handling is safe on Windows/macOS/Linux

## Code of Conduct
- We follow the Contributor Covenant. Please report violations via issues.

## Releases
- We follow semver. Release notes should include key changes and manual verification notes.
