# done-list-generator

[![npm version](https://img.shields.io/npm/v/done-list-generator?style=flat-square)](https://www.npmjs.com/package/done-list-generator)
[![npm downloads](https://img.shields.io/npm/dm/done-list-generator?style=flat-square)](https://www.npmjs.com/package/done-list-generator)
![node >=18](https://img.shields.io/badge/node-%3E%3D18.0.0-339933?style=flat-square&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

从本地 Git 提交生成每日 Done List（Markdown 格式），通过 OpenRouter 使用 LLM。支持跨平台（Windows/macOS/Linux），Node.js 18+。

## 主要功能

- 将提交和 diff 内容总结成简洁的每日 Markdown 报告。
- 增量更新：继续工作时，会追加到当天的文件中。
- 无外部运行时依赖：仅使用内置 `fetch` 和 Git 的基本 `child_process`。
- 跨平台兼容：Windows/macOS/Linux 安全运行，避免 shell 引用问题（使用参数数组）。

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

## 提交范围选择规则

- 如果 `./done-list/YYYY-MM-DD.md` 文件存在且包含 `<!-- lastProcessedCommit: <hash> -->` 注释，则仅处理 `<hash>..HEAD` 范围的提交，并在文件末尾追加“Additional updates (HH:mm)”部分，并更新头部哈希。
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

## 摘要

...

## 详情

- ...
```

同一天后续运行时：

```markdown
## Additional updates (HH:mm)

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
npm i
npm run build
```

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
3. 运行 `npm run build`，然后在实际仓库中验证 `npx donelist --dry-run`。
4. 打开 PR 时，描述动机和方法。

## 许可证

MIT
