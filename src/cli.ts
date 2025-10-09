#!/usr/bin/env node
import { join } from "node:path";
import {
  createConfigResolver,
  type ConfigResolver,
} from "./config.js";
import {
  createGitClient,
  getTodayDateString,
  type GitClient,
} from "./git.js";
import {
  appendIncrementSection,
  extractLastProcessedCommitFromMarkdown,
  readIfExists,
  renderNewMarkdown,
  writeText,
} from "./markdown.js";
import {
  createOpenRouterClient,
  type OpenRouterClient,
} from "./openrouter.js";
import type { CliOptions, CommitWithDiff } from "./types.js";

const DIFF_TRIM_LIMIT = 60_000;

export interface MarkdownRuntime {
  appendIncrementSection: typeof appendIncrementSection;
  extractLastProcessedCommitFromMarkdown: typeof extractLastProcessedCommitFromMarkdown;
  readIfExists: typeof readIfExists;
  renderNewMarkdown: typeof renderNewMarkdown;
  writeText: typeof writeText;
}

export interface ClockRuntime {
  today(): Promise<string>;
  now(): Date;
}

export interface ConsoleRuntime {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  setExitCode: (code: number) => void;
}

export interface CliRuntimeDeps {
  git: GitClient;
  config: ConfigResolver;
  openRouter: OpenRouterClient;
  markdown: MarkdownRuntime;
  clock: ClockRuntime;
  console: ConsoleRuntime;
  cwd: () => string;
}

export interface CliRuntimeOverrides {
  git?: GitClient;
  config?: ConfigResolver;
  openRouter?: OpenRouterClient;
  markdown?: Partial<MarkdownRuntime>;
  clock?: Partial<ClockRuntime>;
  console?: Partial<ConsoleRuntime>;
  cwd?: () => string;
  env?: Record<string, string | undefined>;
  platform?: string;
}

export function parseArgs(argv: string[]): CliOptions {
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
    else if (a === "--author") opts.author = argv[++i];
    else if (a === "--author-email") opts.authorEmail = argv[++i];
  }
  return opts;
}

function buildPrompt(
  dateStr: string,
  lang: string,
  commits: CommitWithDiff[],
  trimDiffs: boolean
): { system: string; user: string } {
  const system = `You are a helper that concisely summarizes software development activities. Output language: ${lang}. The result should be in Markdown format.`;
  const items = commits.map((c) => {
    const meta = `commit ${c.meta.hash}\nauthor ${c.meta.authorName}\ndate ${c.meta.authorDate}\nsubject ${c.meta.subject}`;
    const trimmedDiff =
      trimDiffs && c.diff.length > DIFF_TRIM_LIMIT
        ? c.diff.slice(0, DIFF_TRIM_LIMIT) + "\n...trimmed..."
        : c.diff;
    return `---\n${meta}\n\n${trimmedDiff}`;
  });
  const user = `날짜: ${dateStr}\n요구사항: 변경사항을 액션 중심 bullet로 요약하고, 중복을 제거한 후 본문만 출력(상단 헤더는 출력 금지).\n\n## 요약\n(간결한 핵심 정리)\n\n## 상세\n- 변경 포인트를 항목별로 정리\n\n입력:\n${items.join(
    "\n\n"
  )}`;
  return { system, user };
}

function createDefaultMarkdown(): MarkdownRuntime {
  return {
    appendIncrementSection,
    extractLastProcessedCommitFromMarkdown,
    readIfExists,
    renderNewMarkdown,
    writeText,
  };
}

function createDefaultClock(): ClockRuntime {
  return {
    today: () => getTodayDateString(),
    now: () => new Date(),
  };
}

function createDefaultConsole(): ConsoleRuntime {
  return {
    log: console.log.bind(console),
    error: console.error.bind(console),
    setExitCode: (code: number) => {
      process.exitCode = code;
    },
  };
}

function createRuntime(overrides: CliRuntimeOverrides = {}): CliRuntimeDeps {
  const cwdProvider = overrides.cwd ?? (() => process.cwd());
  const env = overrides.env ?? process.env;
  const platform = overrides.platform ?? process.platform;

  const consoleRuntime: ConsoleRuntime = {
    ...createDefaultConsole(),
    ...(overrides.console ?? {}),
  };

  const markdownRuntime: MarkdownRuntime = {
    ...createDefaultMarkdown(),
    ...(overrides.markdown ?? {}),
  };

  const clockRuntime: ClockRuntime = {
    ...createDefaultClock(),
    ...(overrides.clock ?? {}),
  };

  const git = overrides.git ?? createGitClient();
  const config =
    overrides.config ??
    createConfigResolver({
      cwd: cwdProvider(),
      env,
      platform,
    });
  const openRouter = overrides.openRouter ?? createOpenRouterClient();

  return {
    git,
    config,
    openRouter,
    markdown: markdownRuntime,
    clock: clockRuntime,
    console: consoleRuntime,
    cwd: cwdProvider,
  };
}

export async function runCli(
  argv: string[],
  overrides: CliRuntimeOverrides = {}
): Promise<void> {
  const runtime = createRuntime(overrides);
  const opts = parseArgs(argv);
  const resolved = await runtime.config.resolveConfig(opts);
  const lang = resolved.lang;
  const apiKey = resolved.openrouterKey;
  const dateStr = await runtime.clock.today();
  const outputPath = join(runtime.cwd(), "done-list", `${dateStr}.md`);

  await runtime.git.assertInsideGitRepo();

  const existing = await runtime.markdown.readIfExists(outputPath);
  const lastProcessed = existing
    ? runtime.markdown.extractLastProcessedCommitFromMarkdown(existing)
    : null;

  const defaultAuthor = await runtime.git.getDefaultAuthorFromGitConfig();
  const authorFilter = {
    name: opts.author ?? defaultAuthor.name ?? undefined,
    email: opts.authorEmail ?? defaultAuthor.email ?? undefined,
  } as { name?: string; email?: string };

  let hashes: string[] = [];
  if (opts.since || opts.until) {
    hashes = await runtime.git.getCommitHashesSinceUntil(
      opts.since,
      opts.until,
      authorFilter
    );
  } else if (lastProcessed) {
    hashes = await runtime.git.getCommitHashesRange(
      lastProcessed,
      "HEAD",
      authorFilter
    );
  } else {
    const sinceLocal = `${dateStr} 00:00`;
    hashes = await runtime.git.getCommitHashesSinceUntil(
      sinceLocal,
      undefined,
      authorFilter
    );
  }

  if (hashes.length === 0) {
    if (opts.dryRun) {
      runtime.console.log("오늘 처리할 커밋이 없습니다.");
    } else {
      runtime.console.error("오늘 처리할 커밋이 없습니다.");
    }
    return;
  }

  const commits = await runtime.git.collectCommitsWithDiff(hashes);
  const latest = commits[0]?.meta.hash ?? hashes[0];

  const { system, user } = buildPrompt(
    dateStr,
    lang,
    commits,
    resolved.trimDiffs
  );
  const content = await runtime.openRouter.call(
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
    runtime.console.log(content);
    return;
  }

  if (!existing) {
    const text = runtime.markdown.renderNewMarkdown(
      dateStr,
      lang,
      latest,
      content
    );
    await runtime.markdown.writeText(outputPath, text);
  } else {
    const now = runtime.clock.now();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const appended = runtime.markdown.appendIncrementSection(
      existing,
      `${hh}:${mm}`,
      content,
      latest
    );
    await runtime.markdown.writeText(outputPath, appended);
  }

  runtime.console.log("생성됨:", outputPath);
}

const isDirectExecution = (): boolean => {
  if (!process?.argv?.[1]) return false;
  const scriptPath = process.argv[1].replace(/\\/g, "/");
  const moduleUrl = import.meta.url.replace(/\\/g, "/");
  return moduleUrl.endsWith(scriptPath);
};

if (isDirectExecution()) {
  runCli(process.argv).catch((err) => {
    const consoleRuntime = createDefaultConsole();
    consoleRuntime.error(
      "[오류]",
      err instanceof Error ? err.message : String(err)
    );
    consoleRuntime.setExitCode(1);
  });
}
