# done-list-generator 📄

[![npm version](https://img.shields.io/npm/v/done-list-generator?style=flat-square&logo=npm)](https://www.npmjs.com/package/done-list-generator)
[![npm downloads](https://img.shields.io/npm/dm/done-list-generator?style=flat-square)](https://www.npmjs.com/package/done-list-generator)
![Node >=18](https://img.shields.io/badge/Node-%3E%3D18.0.0-339933?style=flat-square&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](https://github.com/jimyungkoh/done-list-generator/blob/main/LICENSE)

> AI-powered CLI that turns your daily Git commits into a neat Markdown 'Done List' using LLMs ✨

[![lang: 한국어](https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-blue?style=flat-square)](https://github.com/jimyungkoh/done-list-generator/blob/main/docs/ko/README.md)
[![lang: 日本語](https://img.shields.io/badge/lang-%E6%97%A5%E6%9C%AC%E8%AA%9E-blue?style=flat-square)](https://github.com/jimyungkoh/done-list-generator/blob/main/docs/ja/README.md)
[![lang: 简体中文](https://img.shields.io/badge/lang-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-blue?style=flat-square)](https://github.com/jimyungkoh/done-list-generator/blob/main/docs/zh/README.md)

![done-list-generator logo](https://raw.githubusercontent.com/jimyungkoh/done-list-generator/main/docs/assets/logo.svg)

## Features

- Summarize commits and diffs into a concise daily Markdown report
- Works with OpenRouter models (e.g., GPT, Claude, Gemini) via a single API
- Incremental updates: appends to the same day's file as you keep working
- Zero external runtime deps (uses built-in `fetch`, plain `child_process` for Git)
- Cross-platform safe (no shell quoting tricks; argument arrays only)

## Why use done-list-generator?

- Keep a consistent daily "Done List" without manual notes
- Generate developer-friendly Markdown you can paste into PRs, standups, or changelogs
- Filter by your Git identity automatically (reads `user.name` / `user.email`)
- Simple CLI with layered configuration and sensible defaults

## Requirements

- Node.js 18+ (ESM)
- Git installed and available on PATH
- Network access to OpenRouter API

## Installation

You can run it without installing (recommended):

```bash
npx donelist --dry-run
```

Or install globally:

```bash
npm i -g done-list-generator
donelist --dry-run
```

## Quick Start

1. Move to a Git repository root (or any subdirectory inside it).
2. Set your OpenRouter API key and run:

```bash
export OPENROUTER_API_KEY=YOUR_KEY   # Windows PowerShell: $env:OPENROUTER_API_KEY="YOUR_KEY"
npx donelist --lang ko               # or en/ja/zh (default: en)
```

This generates `./done-list/YYYY-MM-DD.md` in your current working directory.

## Example Output

```markdown
# Done List - 2025-10-10

## Summary

- Fixed build caching issue and improved CI stability
- Added --verbose flag and author auto-filtering

## Details

- Update CI: cache restore logic for node_modules
- CLI: introduce --verbose and better error messages
- Docs: add language badges and example GIF placeholder
```

## How it chooses commit range

- If `./done-list/YYYY-MM-DD.md` exists and contains `<!-- lastProcessedCommit: <hash> -->`, it processes commits in `<hash>..HEAD` and appends an "Additional Update (HH:mm)" section to the file, updating the header hash.
- Otherwise, it processes commits from local midnight (`YYYY-MM-DD 00:00`) to now.
- You can override with `--since <iso>` and/or `--until <iso>`.

## CLI

```bash
donelist [--dry-run] [--verbose] [--lang <code>] [--model <name>] \
         [--openrouter-key <key>] [--since <iso>] [--until <iso>] \
         [--author <name>] [--author-email <email>] [--mode summary|detailed]
```

- `--lang <code>`: Output language (default: `en`). Overrides config.
- `--model <name>`: OpenRouter model (optional). Overrides config.
- `--openrouter-key <key>`: If omitted, uses config or `OPENROUTER_API_KEY` env var.
- `--dry-run`: Print to STDOUT without writing files.
- `--since <iso>` / `--until <iso>`: Manually set time window.
- `--verbose`: Extra diagnostics. Overrides config.
- `--author <name>` / `--author-email <email>`: Filter commits by author. If omitted, the tool attempts to read `git config user.name`/`user.email` and applies them as defaults.
- `--mode summary|detailed`: Output section mode (default: `summary`).

## Output

Writes to `./done-list/YYYY-MM-DD.md` (relative to current working directory).
The file starts with a header comment storing the last processed commit:

```markdown
<!-- lastProcessedCommit: <hash> -->

# Done List - YYYY-MM-DD

## Summary

...

## Details

- ...
```

On subsequent runs (same day), it appends:

```markdown
## Additional Update (HH:mm)

...
```

## Configuration & Environment

The tool supports layered configuration with clear precedence (highest first):

- CLI flags: overrides any other source (e.g., `--lang en --model xxx --openrouter-key yyy --verbose`).
- Local config files (project root): `.donelist.json` (higher) or `donelist.json`.
- Global config (user scope):
  - Unix: `$XDG_CONFIG_HOME/donelist/donelist.json` or `~/.config/donelist/donelist.json`
  - Windows: `%USERPROFILE%/AppData/Local/donelist/donelist.json`
- Environment: `OPENROUTER_API_KEY`, `DONELIST_LANG`, `DONELIST_MODEL`, `DONELIST_VERBOSE`, `DONELIST_TRIM_DIFFS` (boolean switch), and `DONELIST_MODE` (`summary`/`detailed`) are used when higher-priority sources omit them.
- Defaults: internal fallbacks apply when nothing else provides a value (`lang` `"en"`, `trimDiffs` `true`, etc.).

### Author auto-filtering

- By default, the tool reads your local Git config (`user.name` / `user.email`) and applies an author filter so that only your commits are included.
- You can override this behavior with `--author` (name) and/or `--author-email` (email). Email has precedence when both are present.
- If neither config nor flags provide author info, no author filter is applied.

During `npm install`, the package initializes a default global config at the path above if none exists.

Defaults:

- `lang`: `"en"`
- `model`: "x-ai/grok-4-fast" (OpenRouter model name)
- `verbose`: `false`
- `trimDiffs`: `true` (truncate commit diffs at ~60k chars)

Example config file (`donelist.json` or `.donelist.json`):

```json
{
  "lang": "ko",
  "model": "x-ai/grok-4-fast",
  "openrouterKey": "sk-...",
  "verbose": true,
  "trimDiffs": false
}
```

- Fields: `lang` ("en"/"ko"/"ja"/"zh"), `model` (OpenRouter model name), `openrouterKey` (API key), `verbose` (boolean), `trimDiffs` (boolean).
- Environment fallbacks: `DONELIST_LANG`, `DONELIST_MODEL`, `DONELIST_VERBOSE`, `DONELIST_TRIM_DIFFS`. Truthy values include `true/1/yes/on`; falsy values include `false/0/no/off`.
- API key resolution order: CLI > config file > environment (`OPENROUTER_API_KEY`) > empty string.

## Cross‑platform notes

- Uses `child_process.spawn('git', args, { shell: false })` with argument arrays for safety on Windows/macOS/Linux.
- Requires `git` on PATH.

## Privacy & Security

The tool sends commit metadata and raw diffs (trimmed if large) to the LLM provider for summarization. Do not use it on repositories containing sensitive information unless your policy allows it. Before using this tool, please refer to your LLM provider's policies.

## Troubleshooting

- "Not a git repository": run inside a Git repo or `git init` first.
- "No commits to process today": no commits in the selected window.
- "OpenRouter key missing": set `OPENROUTER_API_KEY` or pass `--openrouter-key`.

## Contributing ([CONTRIBUTING](https://github.com/jimyungkoh/done-list-generator/blob/main/docs/en/CONTRIBUTING.md))

Contributions are welcome! Please keep changes simple and readable. Simplicity-first and cross-platform safety are hard requirements.

### Development setup

```bash
git clone <this-repo>
cd done-list-generator
pnpm install
pnpm build
```

This repository uses pnpm (v10+) for development workflows. The published CLI remains installable through any Node package manager: `npx donelist --dry-run` or `npm i -g done-list-generator`.

Try it locally inside any Git repo:

```bash
cd /path/to/your/git/repo
OPENROUTER_API_KEY=YOUR_KEY npx donelist --dry-run
```

### Guidelines

- Keep PRs small and focused. Avoid adding new runtime dependencies.
- Cross-platform: always use `child_process.spawn('git', args, { shell: false })` with argument arrays.
- ESM only, Node 18+. Use built-in modules via `node:` specifiers.
- Prefer clear names and small modules. Add types for public surfaces.
- Do not over-engineer: prioritize readability and maintainability.

### Submitting changes

1. Fork the repo and create a feature branch.
2. Implement changes with tests if applicable.
3. Run `pnpm build` and verify `npx donelist --dry-run` works in a real repo.
4. Open a PR describing the motivation and approach.

## Contributors

![contributors](https://img.shields.io/github/contributors/jimyungkoh/done-list-generator?style=flat-square)

If you like this project, ⭐ star it on GitHub or contribute a PR!

Built with ❤️ by [@jimyungkoh](https://github.com/jimyungkoh)

## License

MIT
