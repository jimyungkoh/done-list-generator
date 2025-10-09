import { spawn } from "node:child_process";
import { CommitMeta, CommitWithDiff } from "./types.js";

export interface GitCommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export type GitSpawnFunction = typeof spawn;

export interface GitClient {
  tryRunGitStd(args: string[]): Promise<{
    ok: boolean;
    stdout: string;
    stderr: string;
    code: number;
  }>;
  getCurrentBranch(): Promise<string>;
  getGitConfigValue(key: string): Promise<string | null>;
  getDefaultAuthorFromGitConfig(): Promise<{ name: string | null; email: string | null }>;
  assertInsideGitRepo(): Promise<void>;
  getCommitHashesSinceUntil(
    since?: string,
    until?: string,
    author?: { name?: string | null; email?: string | null }
  ): Promise<string[]>;
  getCommitHashesRange(
    fromExclusive: string | null,
    toInclusive?: string,
    author?: { name?: string | null; email?: string | null }
  ): Promise<string[]>;
  getCommitMeta(hash: string): Promise<CommitMeta>;
  getCommitDiff(hash: string): Promise<string>;
  collectCommitsWithDiff(hashes: string[], limit?: number): Promise<CommitWithDiff[]>;
}

function withStandardGitArgs(args: string[]): string[] {
  return [
    "-c",
    "color.ui=false",
    "-c",
    "core.quotepath=false",
    "--no-pager",
    ...args,
  ];
}

function createGitRunner(spawnImpl: GitSpawnFunction) {
  return function runGit(args: string[]): Promise<GitCommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawnImpl("git", args, { shell: false });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (d: unknown) => {
        stdout += String(d);
      });
      child.stderr?.on("data", (d: unknown) => {
        stderr += String(d);
      });
      child.on("close", (code: unknown) => {
        resolve({ stdout, stderr, code: typeof code === "number" ? code : 0 });
      });
      child.on("error", (err: unknown) => reject(err));
    });
  };
}

export function createGitClient(spawnImpl: GitSpawnFunction = spawn): GitClient {
  const runGit = createGitRunner(spawnImpl);
  const runGitStd = (args: string[]) => runGit(withStandardGitArgs(args));

  const tryRunGitStd = async (args: string[]) => {
    const { stdout, stderr, code } = await runGitStd(args);
    return { ok: code === 0, stdout, stderr, code };
  };

  const getGitConfigValue = async (key: string) => {
    const { stdout, code } = await runGitStd(["config", "--get", key]);
    if (code !== 0) return null;
    const value = stdout.trim();
    return value.length > 0 ? value : null;
  };

  const getDefaultAuthorFromGitConfig = async () => {
    const [name, email] = await Promise.all([
      getGitConfigValue("user.name"),
      getGitConfigValue("user.email"),
    ]);
    return { name, email };
  };

  const assertInsideGitRepo = async () => {
    const { stdout, code } = await runGitStd([
      "rev-parse",
      "--is-inside-work-tree",
    ]);
    if (code !== 0 || stdout.trim() !== "true") {
      throw new Error(
        "The current directory is not a Git repository. Run git init or execute in a proper repository."
      );
    }
  };

  const getCommitHashesSinceUntil = async (
    since?: string,
    until?: string,
    author?: { name?: string | null; email?: string | null }
  ) => {
    const args = ["log", "--format=%H"];
    if (since) args.push(`--since=${since}`);
    if (until) args.push(`--until=${until}`);
    if (author) {
      if (author.email) args.push(`--author=${author.email}`);
      else if (author.name) args.push(`--author=${author.name}`);
    }
    const { stdout, code, stderr } = await runGitStd(args);
    if (code !== 0) {
      throw new Error(`git log failed: ${stderr}`);
    }
    return stdout.split(/\r?\n/).filter(Boolean);
  };

  const getCommitHashesRange = async (
    fromExclusive: string | null,
    toInclusive: string = "HEAD",
    author?: { name?: string | null; email?: string | null }
  ) => {
    const range = fromExclusive
      ? `${fromExclusive}..${toInclusive}`
      : toInclusive;
    const args = ["log", "--format=%H", range];
    if (author) {
      if (author.email) args.push(`--author=${author.email}`);
      else if (author.name) args.push(`--author=${author.name}`);
    }
    const { stdout, code, stderr } = await runGitStd(args);
    if (code !== 0) throw new Error(`git log failed: ${stderr}`);
    return stdout.split(/\r?\n/).filter(Boolean);
  };

  const getCommitMeta = async (hash: string) => {
    const pretty = "%H%n%an%n%ai%n%s%n%b";
    const { stdout, code, stderr } = await runGitStd([
      "show",
      `--pretty=format:${pretty}`,
      "-s",
      hash,
    ]);
    if (code !== 0) throw new Error(`git show meta failed: ${stderr}`);
    const lines = stdout.split(/\r?\n/);
    const [h, authorName, authorDate, subject, ...bodyParts] = lines;
    const body = bodyParts.join("\n").trim();
    return {
      hash: h?.trim() ?? hash,
      authorName: authorName ?? "",
      authorDate: authorDate ?? "",
      subject: subject ?? "",
      body,
    };
  };

  const getCommitDiff = async (hash: string) => {
    const { stdout, code, stderr } = await runGitStd([
      "show",
      "--patch",
      "--unified=0",
      hash,
    ]);
    if (code !== 0) throw new Error(`git show diff failed: ${stderr}`);
    return stdout;
  };

  const collectCommitsWithDiff = async (hashes: string[], limit?: number) => {
    const result: CommitWithDiff[] = [];
    const take = typeof limit === "number" ? Math.max(0, limit) : hashes.length;
    for (let i = 0; i < Math.min(hashes.length, take); i++) {
      const h = hashes[i];
      const [meta, diff] = await Promise.all([
        getCommitMeta(h),
        getCommitDiff(h),
      ]);
      result.push({ meta, diff });
    }
    return result;
  };

  const getCurrentBranch = async () => {
    const attempt = await tryRunGitStd(["branch", "--show-current"]);
    const name = attempt.stdout.trim();
    if (attempt.ok && name) return name;
    const { stdout, code, stderr } = await runGitStd([
      "rev-parse",
      "--abbrev-ref",
      "HEAD",
    ]);
    if (code !== 0) throw new Error(`git rev-parse failed: ${stderr}`);
    return stdout.trim();
  };

  return {
    tryRunGitStd,
    getCurrentBranch,
    getGitConfigValue,
    getDefaultAuthorFromGitConfig,
    assertInsideGitRepo,
    getCommitHashesSinceUntil,
    getCommitHashesRange,
    getCommitMeta,
    getCommitDiff,
    collectCommitsWithDiff,
  };
}

const defaultGitClient = createGitClient();

export const tryRunGitStd = defaultGitClient.tryRunGitStd;
export const getCurrentBranch = defaultGitClient.getCurrentBranch;
export const getGitConfigValue = defaultGitClient.getGitConfigValue;
export const getDefaultAuthorFromGitConfig =
  defaultGitClient.getDefaultAuthorFromGitConfig;
export const assertInsideGitRepo = defaultGitClient.assertInsideGitRepo;
export const getCommitHashesSinceUntil =
  defaultGitClient.getCommitHashesSinceUntil;
export const getCommitHashesRange =
  defaultGitClient.getCommitHashesRange;
export const getCommitMeta = defaultGitClient.getCommitMeta;
export const getCommitDiff = defaultGitClient.getCommitDiff;
export const collectCommitsWithDiff =
  defaultGitClient.collectCommitsWithDiff;

export async function getTodayDateString(): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
