#!/usr/bin/env node
import { readFile as readFileFs } from "node:fs/promises";
import { join } from "node:path";
import { createConfigResolver, type ConfigResolver } from "./config.js";
import { createGitClient, getTodayDateString, type GitClient } from "./git.js";
import {
  appendIncrementSection,
  extractLastProcessedCommitFromMarkdown,
  readIfExists,
  renderNewMarkdown,
  writeText,
} from "./markdown.js";
import { createOpenRouterClient, type OpenRouterClient } from "./openrouter.js";
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
    else if (a === "--mode") opts.mode = argv[++i] as any; // validated later via config
  }
  return opts;
}

function isHelpRequest(argv: string[]): boolean {
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h" || a === "help") return true;
  }
  return false;
}

function isVersionRequest(argv: string[]): boolean {
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--version" || a === "-V") return true;
  }
  return false;
}

function findUnknownFlags(argv: string[]): string[] {
  const boolFlags = new Set([
    "--dry-run",
    "--verbose",
    "--help",
    "-h",
    "--version",
    "-V",
  ]);
  const valueFlags = new Set([
    "--lang",
    "--model",
    "--openrouter-key",
    "--since",
    "--until",
    "--author",
    "--author-email",
    "--mode",
  ]);

  const unknown: string[] = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "help" || a === "version") continue; // positional helpers
    if (boolFlags.has(a)) continue;
    if (valueFlags.has(a)) {
      // consume value if present
      if (i + 1 < argv.length) i++;
      continue;
    }
    if (typeof a === "string" && a.startsWith("-")) {
      unknown.push(a);
    }
  }
  // de-dup while preserving first occurrence
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of unknown) {
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

function buildHelpText(): string {
  return [
    "Usage:",
    "  donelist [options]",
    "",
    "Options:",
    "  --dry-run                 Print to STDOUT without writing files",
    "  --verbose                 Extra diagnostics",
    "  --lang <code>            Output language (default: en; ko/en/ja/zh)",
    "  --model <name>           OpenRouter model name",
    "  --openrouter-key <key>   OpenRouter API key",
    "  --since <iso>            Start time (e.g., 2025-10-10 00:00)",
    "  --until <iso>            End time",
    "  --author <name>          Filter by author name",
    "  --author-email <email>   Filter by author email",
    "  --mode summary|detailed  Output section mode (default: summary)",
    "  -h, --help               Show this help",
    "  -V, --version            Show version",
    "",
    "Examples:",
    "  npx donelist --dry-run",
    "  donelist --lang en",
  ].join("\n");
}

async function readPackageVersion(): Promise<string> {
  try {
    const pkgUrl = new URL("../package.json", import.meta.url);
    const txt = await readFileFs(pkgUrl, { encoding: "utf8" });
    const pkg = JSON.parse(txt) as { version?: string; name?: string };
    const name = pkg.name ?? "donelist";
    const ver = pkg.version ?? "unknown";
    return `${name} v${ver}`;
  } catch {
    return "donelist vunknown";
  }
}

function getLocalizedLabels(language: string): {
  summary: string;
  details: string;
} {
  const lang = (language || "").toLowerCase();
  if (lang.startsWith("ko")) return { summary: "요약", details: "세부 사항" };
  if (lang.startsWith("ja")) return { summary: "要約", details: "詳細" };
  if (lang.startsWith("zh")) return { summary: "摘要", details: "详情" };
  return { summary: "Summary", details: "Details" };
}

function buildPrompt(
  dateStr: string,
  lang: string,
  commits: CommitWithDiff[],
  trimDiffs: boolean,
  mode: "summary" | "detailed"
): { system: string; user: string } {
  const { summary, details } = getLocalizedLabels(lang);
  const system = `You are a helper that concisely summarizes software development activities. Output language: ${lang}. The result should be in Markdown format.`;
  const items = commits.map((c) => {
    const meta = `commit ${c.meta.hash}\nauthor ${c.meta.authorName}\ndate ${c.meta.authorDate}\nsubject ${c.meta.subject}`;
    const trimmedDiff =
      trimDiffs && c.diff.length > DIFF_TRIM_LIMIT
        ? c.diff.slice(0, DIFF_TRIM_LIMIT) + "\n...trimmed..."
        : c.diff;
    return `---\n${meta}\n\n${trimmedDiff}`;
  });
  const sections =
    mode === "summary"
      ? `## ${summary}\n(Concise key points)`
      : `## ${summary}\n(Concise key points)\n\n## ${details}\n- Organize changes by item`;
  const user = `Date: ${dateStr}\nRequirements: Summarize changes as action-oriented bullets, deduplicate, and output only the body (no top-level header). Use section headings exactly as shown below.\n\n${sections}\n\nInput:\n${items.join(
    "\n\n"
  )}`;
  return { system, user };
}

function normalizeHeadingsToLocalized(content: string, lang: string): string {
  const { summary, details } = getLocalizedLabels(lang);
  let out = content;
  out = out.replace(/^##\s*Summary\s*$/gim, `## ${summary}`);
  out = out.replace(/^##\s*Details\s*$/gim, `## ${details}`);
  return out;
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

  // Meta commands: help/version handled before any heavy work
  if (isHelpRequest(argv)) {
    runtime.console.log(buildHelpText());
    runtime.console.setExitCode(0);
    return;
  }
  if (isVersionRequest(argv)) {
    const v = await readPackageVersion();
    runtime.console.log(v);
    runtime.console.setExitCode(0);
    return;
  }

  // Unknown flag detection (does not treat positionals as errors)
  const unknown = findUnknownFlags(argv);
  if (unknown.length > 0) {
    runtime.console.error(`Unknown option(s): ${unknown.join(", ")}`);
    runtime.console.error("Usage: donelist [options]");
    runtime.console.error("Help: donelist --help");
    runtime.console.setExitCode(2);
    return;
  }

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
      runtime.console.log("No commits to process today.");
    } else {
      runtime.console.error("No commits to process today.");
    }
    return;
  }

  const commits = await runtime.git.collectCommitsWithDiff(hashes);
  const latest = commits[0]?.meta.hash ?? hashes[0];

  const { system, user } = buildPrompt(
    dateStr,
    lang,
    commits,
    resolved.trimDiffs,
    resolved.mode
  );
  const contentRaw = await runtime.openRouter.call(
    apiKey,
    {
      model: resolved.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    resolved.verbose ?? opts.verbose
  );
  const content = normalizeHeadingsToLocalized(contentRaw, lang);

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

  runtime.console.log("Created:", outputPath);
}
