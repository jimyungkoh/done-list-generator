# done-list-generator 🧾

[![npm version](https://img.shields.io/npm/v/done-list-generator?style=flat-square&logo=npm)](https://www.npmjs.com/package/done-list-generator)
[![npm downloads](https://img.shields.io/npm/dm/done-list-generator?style=flat-square)](https://www.npmjs.com/package/done-list-generator)
![Node >=18](https://img.shields.io/badge/Node-%3E%3D18.0.0-339933?style=flat-square&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](../../LICENSE)

> 基于 AI 的 CLI，可将本地 Git 提交转换为精美的 Markdown「Done List」日报。通过 OpenRouter（GPT/Claude/Gemini 等）工作，支持 Windows/macOS/Linux。

![done-list-generator logo](../assets/logo.svg)

## 主要功能

- 将提交和 diff 总结为简洁的每日 Markdown 报告
- 通过 OpenRouter 的统一 API 使用 GPT/Claude/Gemini 等模型
- 增量更新：同一天后续运行自动追加到当天文件
- 无外部运行时依赖：仅使用内置 `fetch` 和 Git 的基本 `child_process`
- 跨平台兼容：Windows/macOS/Linux 安全运行，避免 shell 引用问题（参数数组）

## 为什么选择 done-list-generator？

- 无需手写也能持续维护每日「Done List」
- 生成适合粘贴到 PR/站会/变更日志的 Markdown
- 自动读取 Git 身份(`user.name`/`user.email`)进行作者过滤
- 简单 CLI + 分层配置 + 合理默认值

## 要求

- Node.js 18+（支持 ESM 模块）
- Git 已安装并在 PATH 中
- 网络访问 OpenRouter API

## 安装方式

推荐无需安装直接运行：

```bash
npx donelist --dry-run
```

或全局安装：

```bash
npm i -g done-list-generator
donelist --dry-run
```

## 快速开始

1. 切换到 Git 仓库根目录（或其子目录）。
2. 设置 OpenRouter API 密钥后运行：

```bash
export OPENROUTER_API_KEY=YOUR_KEY   # Windows PowerShell: $env:OPENROUTER_API_KEY="YOUR_KEY"
npx donelist --lang zh               # 也可使用 en/ko/ja（默认：en）
```

将在当前工作目录生成 `./done-list/YYYY-MM-DD.md` 文件。

## 示例输出

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

## 提交范围选择规则

- 如果 `./done-list/YYYY-MM-DD.md` 文件存在且包含 `<!-- lastProcessedCommit: <hash> -->` 注释，则仅处理 `<hash>..HEAD` 范围的提交，并在文件末尾追加 “Additional Update (HH:mm)” 部分，并更新头部哈希。
- 否则，从本地午夜（YYYY-MM-DD 00:00）到当前时间处理提交。
- 可使用 `--since <iso>` 或 `--until <iso>` 选项手动指定范围。

## CLI 选项

```bash
donelist [--dry-run] [--verbose] [--lang <code>] [--model <name>] \
         [--openrouter-key <key>] [--since <iso>] [--until <iso>]
```

- `--lang <code>`：输出语言(默认：`en`)。覆盖配置。
- `--model <name>`：指定 OpenRouter 模型(可选)。覆盖配置。
- `--openrouter-key <key>`：省略时，使用配置或 `OPENROUTER_API_KEY` 环境变量。
- `--dry-run`：仅输出到控制台，不保存文件。
- `--since <iso>` / `--until <iso>`：手动设置时间范围。
- `--verbose`：显示详细日志。覆盖配置。

## 输出格式

保存到当前工作目录的 `./done-list/YYYY-MM-DD.md`。文件以存储最后处理提交哈希的头部注释开头：

```markdown
<!-- lastProcessedCommit: <hash> -->

# Done List - YYYY-MM-DD

## Summary

...

## Details

- ...
```

同一天后续运行时：

```markdown
## Additional Update (HH:mm)

...
```

## 配置与环境

工具支持分层配置（优先级：高 → 低）：

- **CLI 标志**：如 `--lang en --model xxx --openrouter-key yyy --verbose`。
- **本地配置文件**（项目根目录）：`.donelist.json` → `donelist.json`。
- **全局配置**（用户范围）：
  - Unix：`$XDG_CONFIG_HOME/donelist/donelist.json` 或 `~/.config/donelist/donelist.json`
  - Windows：`%USERPROFILE%/AppData/Local/donelist/donelist.json`
- **环境变量**：仅当优先级更高的来源未提供时读取 `OPENROUTER_API_KEY`、`DONELIST_LANG`、`DONELIST_MODEL`、`DONELIST_VERBOSE`、`DONELIST_TRIM_DIFFS`。

在执行 `npm install` 时，如果上述全局路径中没有配置文件，会自动创建一个默认文件。

默认值：

- `lang`: `"en"`
- `model`: 默认无（需通过 CLI/配置指定）
- `verbose`: `false`
- `trimDiffs`: `true`（当 diff 超过 6 万字符时会截断）

配置按优先级合并，高优先级覆盖低优先级。

### 示例本地配置 (`donelist.json` 或 `.donelist.json`)

```json
{
  "lang": "ko",
  "model": "openai/gpt-4.1-mini",
  "openrouterKey": "sk-...",
  "verbose": true,
  "trimDiffs": false
}
```

- JSON 解析错误或文件缺失静默忽略(使用默认值)。
- API 密钥：CLI &gt; 配置文件 &gt; 环境变量(`OPENROUTER_API_KEY`) &gt; 空字符串(空则失败) 顺序解析。
- 字段：`lang` ("en"/"ko"/"ja"/"zh")、`model` (OpenRouter 模型名)、`openrouterKey` (API 密钥)、`verbose` (布尔值)、`trimDiffs` (布尔值)。
- 环境变量解析：`DONELIST_LANG`、`DONELIST_MODEL`、`DONELIST_VERBOSE`、`DONELIST_TRIM_DIFFS`。`true/1/yes/on` → true，`false/0/no/off` → false。

## 跨平台注意事项

- 使用 `child_process.spawn('git', args, { shell: false })` 和参数数组，确保 Windows/macOS/Linux 稳定运行。
- 需要 PATH 中的 Git。

## 隐私与安全

工具会将提交元数据和原始 diff（大文件时截断）发送到 LLM 提供商（OpenRouter）进行总结。包含敏感信息的仓库请避免使用，并在使用前参考所用 LLM 提供商的政策。

## 故障排除

- "Not a git repository"：在 Git 仓库内运行，或先执行 `git init`。
- "No commits to process today"：指定时间范围内无提交。
- "OpenRouter key missing"：设置 `OPENROUTER_API_KEY` 或使用 `--openrouter-key` 选项。

## 贡献指南 ([CONTRIBUTING](./CONTRIBUTING.md))

欢迎贡献！请保持变更简单易读。优先考虑简洁性和跨平台兼容。

### 开发环境设置

```bash
git clone <this-repo>
cd done-list-generator
pnpm install
pnpm build
```

本仓库在开发流程中使用 pnpm (10+)。已发布的 CLI 仍可通过任意包管理器使用，例如 `npx donelist --dry-run` 或 `npm i -g done-list-generator`。

在任意 Git 仓库中本地测试：

```bash
cd /path/to/your/git/repo
OPENROUTER_API_KEY=YOUR_KEY npx donelist --dry-run
```

### 贡献准则

- PR 保持小型且专注，避免添加新运行时依赖。
- 跨平台：始终使用 `child_process.spawn('git', args, { shell: false })` 和参数数组。
- 仅支持 ESM，Node 18+。使用 `node:` 前缀导入内置模块。
- 优先清晰命名和小模块。为公共接口添加类型。
- 避免过度设计：优先可读性和可维护性。

### 提交变更

1. 分叉仓库并创建功能分支。
2. 实现变更，并尽可能添加测试。
3. 运行 `pnpm build`，然后在实际仓库中验证 `npx donelist --dry-run`。
4. 打开 PR 时，描述动机和方法。

## 贡献者

![contributors](https://img.shields.io/github/contributors/jimyungkoh/done-list-generator?style=flat-square)

如果你喜欢这个项目，欢迎 ⭐ Star 或提交 PR！

作者: [@jimyungkoh](https://github.com/jimyungkoh)

## 许可证

MIT
