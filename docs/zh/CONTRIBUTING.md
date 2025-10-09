# 贡献指南

感谢您对本项目的支持！请遵循以下指南参与贡献。

## 原则
- 简洁、可读、跨平台安全优先。
- 尽量避免新增运行时依赖，优先使用 Node.js 内置与标准 API。

## 工作流程
1. 先创建 Issue 或选择带标签的任务（`good first issue`、`help wanted`）。
2. Fork 仓库并创建分支：`feature/<summary>` 或 `fix/<summary>`。
3. 小步提交并遵循 Conventional Commits。
4. 通过手动验证清单。
5. 提交 PR，说明动机、方案与验证结果。

## 提交规范（Conventional Commits）
- 格式：`type: description`
- 示例：`feat: add --lang default resolution`

## 分支策略
- 推荐使用 `feature/*`、`fix/*`、`docs/*`。

## 脚本
- `npm run build`, `npm run dev`, `npm run start`, `npm run clean`

## 安全与隐私
- 不要硬编码 API Key；使用 `OPENROUTER_API_KEY` 或 `--openrouter-key`。
- 提交元数据与 Diff 可能会发送至 LLM 提供商，请谨慎使用。

## 手动验证清单
- `npm run build` 成功
- 在任意 Git 仓库执行：`OPENROUTER_API_KEY=YOUR_KEY npx donelist --dry-run`
- 同日重复执行时应追加 “Additional updates (HH:mm)” 段落
