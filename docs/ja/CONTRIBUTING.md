# Contributing

このプロジェクトへのご協力ありがとうございます。以下のガイドラインに従ってください。

## 方針
- シンプルさ・可読性・クロスプラットフォーム安全性を最優先。
- ランタイム依存関係の追加は極力避けます。

## ワークフロー
1. Issue を作成するか、既存のラベル付き Issue を選ぶ（`good first issue`, `help wanted`）。
2. フォークしてブランチ作成（`feature/<summary>` / `fix/<summary>`）。
3. 小さな単位でコミット（Conventional Commits）。
4. 手動検証チェックリストを実施。
5. PR を作成し、動機・アプローチ・検証結果を記載。

## Conventional Commits
- 形式: `type: description`
- 例: `feat: add --lang default resolution`

## ブランチ
- `feature/*`, `fix/*`, `docs/*` を推奨。

## スクリプト
- `npm run build`, `npm run dev`, `npm run start`, `npm run clean`

## セキュリティ
- `OPENROUTER_API_KEY` を使用。秘匿情報は送信しないでください。

## 手動検証
- `npm run build`
- 任意の Git リポジトリで `OPENROUTER_API_KEY=YOUR_KEY npx donelist --dry-run`
- 同日再実行で「Additional updates (HH:mm)」が追記されること
