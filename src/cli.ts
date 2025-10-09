#!/usr/bin/env node
import { join } from "node:path";
import { resolveConfig } from "./config.js";
import {
  assertInsideGitRepo,
  collectCommitsWithDiff,
  getCommitHashesRange,
  getCommitHashesSinceUntil,
  getTodayDateString,
} from "./git.js";
import {
  appendIncrementSection,
  extractLastProcessedCommitFromMarkdown,
  readIfExists,
  renderNewMarkdown,
  writeText,
} from "./markdown.js";
import { callOpenRouter } from "./openrouter.js";
import type { CliOptions, CommitWithDiff } from "./types.js";

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--verbose") opts.verbose = true;
    else if (a === "--lang") opts.lang = argv[++i];
    else if (a === "--model") opts.model = argv[++i];
    else if (a === "--openrouter-key") opts.openrouterKey = argv[++i];
    else if (a === "--since") opts.since = argv[++i];
    else if (a === "--until") opts.until = argv[++i];
  }
  return opts;
}

function buildPrompt(
  dateStr: string,
  lang: string,
  commits: CommitWithDiff[]
): { system: string; user: string } {
  const system = `You are a helper that concisely summarizes software development activities. Output language: ${lang}. The result should be in Markdown format.`;
  const items = commits.map((c) => {
    const meta = `commit ${c.meta.hash}\nauthor ${c.meta.authorName}\ndate ${c.meta.authorDate}\nsubject ${c.meta.subject}`;
    const trimmedDiff =
      c.diff.length > 60_000
        ? c.diff.slice(0, 60_000) + "\n...trimmed..."
        : c.diff;
    return `---\n${meta}\n\n${trimmedDiff}`;
  });
  const user = `날짜: ${dateStr}\n요구사항: 변경사항을 액션 중심 bullet로 요약하고, 중복을 제거한 후 본문만 출력(상단 헤더는 출력 금지).\n\n## 요약\n(간결한 핵심 정리)\n\n## 상세\n- 변경 포인트를 항목별로 정리\n\n입력:\n${items.join(
    "\n\n"
  )}`;
  return { system, user };
}

async function main() {
  const opts = parseArgs(process.argv);
  const resolved = await resolveConfig(opts);
  const lang = resolved.lang;
  const apiKey = resolved.openrouterKey;
  const dateStr = await getTodayDateString();
  const outputPath = join(process.cwd(), "done-list", `${dateStr}.md`);

  await assertInsideGitRepo();

  const existing = await readIfExists(outputPath);
  const lastProcessed = existing
    ? extractLastProcessedCommitFromMarkdown(existing)
    : null;

  let hashes: string[] = [];
  if (opts.since || opts.until) {
    hashes = await getCommitHashesSinceUntil(opts.since, opts.until);
  } else if (lastProcessed) {
    hashes = await getCommitHashesRange(lastProcessed, "HEAD");
  } else {
    const sinceLocal = `${dateStr} 00:00`;
    hashes = await getCommitHashesSinceUntil(sinceLocal, undefined);
  }

  if (hashes.length === 0) {
    if (opts.dryRun) {
      // eslint-disable-next-line no-console
      console.log("오늘 처리할 커밋이 없습니다.");
      return;
    } else {
      // eslint-disable-next-line no-console
      console.error("오늘 처리할 커밋이 없습니다.");
      return;
    }
  }

  const commits = await collectCommitsWithDiff(hashes);
  const latest = commits[0]?.meta.hash ?? hashes[0];

  const { system, user } = buildPrompt(dateStr, lang, commits);
  const content = await callOpenRouter(
    apiKey,
    {
      model: resolved.model ?? opts.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    resolved.verbose ?? opts.verbose
  );

  if (opts.dryRun) {
    // eslint-disable-next-line no-console
    console.log(content);
    return;
  }

  if (!existing) {
    const text = renderNewMarkdown(dateStr, lang, latest, content);
    await writeText(outputPath, text);
  } else {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const appended = appendIncrementSection(
      existing,
      `${hh}:${mm}`,
      content,
      latest
    );
    await writeText(outputPath, appended);
  }

  // eslint-disable-next-line no-console
  console.log("생성됨:", outputPath);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[오류]", err.message || err);
  process.exitCode = 1;
});
