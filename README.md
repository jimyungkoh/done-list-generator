# done-list-generator

[![npm version](https://img.shields.io/npm/v/done-list-generator?style=flat-square)](https://www.npmjs.com/package/done-list-generator)
[![npm downloads](https://img.shields.io/npm/dm/done-list-generator?style=flat-square)](https://www.npmjs.com/package/done-list-generator)
![node >=18](https://img.shields.io/badge/node-%3E%3D18.0.0-339933?style=flat-square&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

Generate a daily Done List (Markdown) from your local Git commits using an LLM (via OpenRouter). Cross-platform (Windows/macOS/Linux), Node 18+.

[한국어](docs/readme/ko.md) [日本語](docs/readme/ja.md) [中文](docs/readme/zh.md)

## Features

- Summarize commits and diffs into a concise daily Markdown report
- Incremental updates: appends to the same day's file as you keep working
- Zero external runtime deps (uses built-in `fetch`, plain `child_process` for Git)
- Cross-platform safe (no shell quoting tricks; argument arrays only)

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

## How it chooses commit range

- If `./done-list/YYYY-MM-DD.md` exists and contains `<!-- lastProcessedCommit: <hash> -->`, it processes commits in `<hash>..HEAD` and appends an "Additional updates (HH:mm)" section to the file, updating the header hash.
- Otherwise, it processes commits from local midnight (`YYYY-MM-DD 00:00`) to now.
- You can override with `--since <iso>` and/or `--until <iso>`.

## CLI

```bash
donelist [--dry-run] [--verbose] [--lang <code>] [--model <name>] \
         [--openrouter-key <key>] [--since <iso>] [--until <iso>] \
         [--author <name>] [--author-email <email>]
```

- `--lang <code>`: Output language (default: `en`). Overrides config.
- `--model <name>`: OpenRouter model (optional). Overrides config.
- `--openrouter-key <key>`: If omitted, uses config or `OPENROUTER_API_KEY` env var.
- `--dry-run`: Print to STDOUT without writing files.
- `--since <iso>` / `--until <iso>`: Manually set time window.
- `--verbose`: Extra diagnostics. Overrides config.
- `--author <name>` / `--author-email <email>`: Filter commits by author. If omitted, the tool attempts to read `git config user.name`/`user.email` and applies them as defaults.

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
## Additional updates (HH:mm)

...
```

## Configuration & Environment

The tool supports layered configuration with clear precedence (highest first):

- CLI flags: overrides any other source (e.g., `--lang en --model xxx --openrouter-key yyy --verbose`).
- Local config files (project root): `.donelist.json` (higher) or `donelist.json`.
- Global config (user scope):
  - Unix: `$XDG_CONFIG_HOME/donelist/donelist.json` or `~/.config/donelist/donelist.json`
  - Windows: `%USERPROFILE%/AppData/Local/donelist/donelist.json`
- Environment: `OPENROUTER_API_KEY`, `DONELIST_LANG`, `DONELIST_MODEL`, `DONELIST_VERBOSE`, and `DONELIST_TRIM_DIFFS` (boolean switch) are used when higher-priority sources omit them.

### Author auto-filtering

- By default, the tool reads your local Git config (`user.name` / `user.email`) and applies an author filter so that only your commits are included.
- You can override this behavior with `--author` (name) and/or `--author-email` (email). Email has precedence when both are present.
- If neither config nor flags provide author info, no author filter is applied.

During `npm install`, the package initializes a default global config at the path above if none exists.

Defaults:

- `lang`: `"en"`
- `model`: no default (provide via CLI/config)
- `verbose`: `false`
- `trimDiffs`: `true` (truncate commit diffs at ~60k chars)

Example config file (`donelist.json` or `.donelist.json`):

```json
{
  "lang": "ko",
  "model": "openai/gpt-4.1-mini",
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

## Contributing

Contributions are welcome! Please keep changes simple and readable. Simplicity-first and cross-platform safety are hard requirements.

### Development setup

```bash
git clone <this-repo>
cd done-list-generator
npm i
npm run build
```

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
3. Run `npm run build` and verify `npx donelist --dry-run` works in a real repo.
4. Open a PR describing the motivation and approach.

## License

MIT
