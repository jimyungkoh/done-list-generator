# done-list-generator

[![npm version](https://img.shields.io/npm/v/done-list-generator?style=flat-square)](https://www.npmjs.com/package/done-list-generator)
[![npm downloads](https://img.shields.io/npm/dm/done-list-generator?style=flat-square)](https://www.npmjs.com/package/done-list-generator)
![node >=18](https://img.shields.io/badge/node-%3E%3D18.0.0-339933?style=flat-square&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

ローカル Git コミットから日次の Done List（Markdown）を生成するツールです。OpenRouter を介した LLM を活用し、Windows/macOS/Linux に対応、Node.js 18 以上をサポートします。

## 主な機能

- コミットと差分（diff）を要約し、簡潔な日次 Markdown レポートを作成します。
- 増分更新：同日の追加作業時に既存ファイルに内容を追加します。
- 外部ランタイム依存なし：組み込みの `fetch` と Git 用の基本 `child_process` のみを使用します。
- プラットフォーム互換性：Windows/macOS/Linux で安全に動作し、シェル引用の問題を回避します（引数配列を使用）。

## 要件

- Node.js 18 以上（ESM モジュール対応）
- PATH に Git をインストール
- OpenRouter API へのネットワーク接続

## インストール方法

インストールせずに直接実行することを推奨します：

```bash
npx donelist --dry-run
```

グローバルインストールする場合は：

```bash
npm i -g done-list-generator
donelist --dry-run
```

## クイックスタート

1. Git リポジトリのルートディレクトリ（またはそのサブディレクトリ）に移動してください。
2. OpenRouter API キーを設定した後、実行してください：

```bash
export OPENROUTER_API_KEY=YOUR_KEY   # Windows PowerShell: $env:OPENROUTER_API_KEY="YOUR_KEY"
npx donelist --lang ja               # en/ko/zh も可能（デフォルト: en）
```

現在の作業ディレクトリに `./done-list/YYYY-MM-DD.md` ファイルが生成されます。

## コミット範囲の選択基準

- `./done-list/YYYY-MM-DD.md` ファイルが存在し、`<!-- lastProcessedCommit: <hash> -->` コメントが含まれている場合、`<hash>..HEAD` 範囲のコミットのみを処理し、「追加更新 (HH:mm)」セクションをファイル末尾に追加してヘッダーハッシュを更新します。
- そうでない場合、本日の午前 0 時（YYYY-MM-DD 00:00）から現在までのコミットを処理します。
- `--since <iso>` または `--until <iso>` オプションで範囲を直接指定できます。

## CLI オプション

```bash
donelist [--dry-run] [--verbose] [--lang <code>] [--model <name>] \
         [--openrouter-key <key>] [--since <iso>] [--until <iso>]
```

- `--lang <code>`: 出力言語(デフォルト: `en`)。設定ファイルの上書き。
- `--model <name>`: OpenRouter モデル指定(オプション)。設定ファイルの上書き。
- `--openrouter-key <key>`: 指定なしの場合、設定ファイルまたは `OPENROUTER_API_KEY` 環境変数を使用。
- `--dry-run`: ファイルを保存せずコンソールに出力。
- `--since <iso>` / `--until <iso>`: 時間範囲を手動設定。
- `--verbose`: 詳細ログ出力。設定ファイルの上書き。

## 出力形式

現在の作業ディレクトリの `./done-list/YYYY-MM-DD.md` に保存されます。ファイルは最後に処理されたコミットハッシュを保存するヘッダーコメントから始まります：

```markdown
<!-- lastProcessedCommit: <hash> -->

# Done List - YYYY-MM-DD

## 要約

...

## 詳細

- ...
```

同日の後続実行時：

```markdown
## 追加更新 (HH:mm)

...
```

## 設定と環境

ツールは柔軟性のために階層化された設定をサポートします（優先度：高 → 低）：

- **CLI フラグ**：例）`--lang en --model xxx --openrouter-key yyy --verbose`
- **ローカル設定ファイル**（プロジェクトルート）：`.donelist.json` → `donelist.json`
- **グローバル設定**（ユーザー範囲）：
  - Unix：`$XDG_CONFIG_HOME/donelist/donelist.json` または `~/.config/donelist/donelist.json`
  - Windows：`%USERPROFILE%/AppData/Local/donelist/donelist.json`
- **環境変数**：`OPENROUTER_API_KEY`、`DONELIST_LANG`、`DONELIST_MODEL`、`DONELIST_VERBOSE`、`DONELIST_TRIM_DIFFS`（優先度の高いものに未指定の場合に使用）

`npm install` 時に上記のグローバルパスに設定ファイルが無ければ自動生成されます。

デフォルト値：

- `lang`: `"en"`
- `model`: 既定なし（CLI/設定で指定）
- `verbose`: `false`
- `trimDiffs`: `true`（コミット diff が 6 万文字を超えると切り詰めます）

設定は優先度に従ってマージされ、優先度の高いものが低いものを上書きします。

### ローカル設定の例 (`donelist.json` または `.donelist.json`)

```json
{
  "lang": "ko",
  "model": "openai/gpt-4.1-mini",
  "openrouterKey": "sk-...",
  "verbose": true,
  "trimDiffs": false
}
```

- JSON パースエラーやファイル欠如は静かに無視(デフォルト使用)。
- API キー: CLI &gt; 設定ファイル &gt; 環境変数(`OPENROUTER_API_KEY`) &gt; 空文字列(空の場合失敗) の順で解決。
- フィールド: `lang` ("en"/"ko"/"ja"/"zh")、`model` (OpenRouter モデル名)、`openrouterKey` (API キー)、`verbose` (ブール値)、`trimDiffs` (ブール値)。
- 環境変数の解釈: `DONELIST_LANG`、`DONELIST_MODEL`、`DONELIST_VERBOSE`、`DONELIST_TRIM_DIFFS`。`true/1/yes/on` → true、`false/0/no/off` → false と判定します。

## プラットフォーム互換性の注意事項

- `child_process.spawn('git', args, { shell: false })` と引数配列を使用して、Windows/macOS/Linux で安定して動作します。
- Git が PATH にインストールされている必要があります。

## プライバシーとセキュリティ

このツールは要約のために LLM プロバイダー（OpenRouter）にコミットメタデータと差分（diff、大規模な場合はトリミング）を送信します。機密情報を含むリポジトリでの使用は避け、利用前に使用する LLM プロバイダーのポリシーをご参照ください。

## トラブルシューティング

- "Not a git repository": Git リポジトリ内で実行するか、`git init` で初期化してください。
- "No commits to process today": 指定された時間範囲にコミットがありません。
- "OpenRouter key missing": `OPENROUTER_API_KEY` を設定するか、`--openrouter-key` オプションを使用してください。

## 貢献ガイド ([CONTRIBUTING](./CONTRIBUTING.md))

貢献を歓迎します！変更はシンプルで読みやすく保ってください。シンプルさとプラットフォーム互換性を最優先にします。

### 開発環境設定

```bash
git clone <this-repo>
cd done-list-generator
npm i
npm run build
```

任意の Git リポジトリでローカルテスト：

```bash
cd /path/to/your/git/repo
OPENROUTER_API_KEY=YOUR_KEY npx donelist --dry-run
```

### 貢献ガイドライン

- PR は小さく集中させてください。新規ランタイム依存を追加しないでください。
- プラットフォーム互換：常に `child_process.spawn('git', args, { shell: false })` と引数配列を使用してください。
- ESM のみ、Node 18 以上。`node:` プレフィックスで組み込みモジュールを使用してください。
- 明確な名前と小さなモジュールを優先します。公開インターフェースには型を追加してください。
- 過度な設計は避けてください：読みやすさとメンテナビリティを優先してください。

### 変更の送信

- リポジトリをフォークし、機能ブランチを作成します。
- 変更を実装し、可能であればテストを追加します。
- `npm run build` を実行した後、実際のリポジトリで `npx donelist --dry-run` を確認してください。
- PR を開く際は、動機とアプローチを説明してください。

## ライセンス

MIT
