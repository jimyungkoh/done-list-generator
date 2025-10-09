import { spawn } from "node:child_process";
import { CommitMeta, CommitWithDiff } from "./types.js";

function runGit(
  args: string[]
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: any) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d: any) => (stderr += d.toString("utf8")));
    child.on("close", (code: any) =>
      resolve({ stdout, stderr, code: code ?? 0 })
    );
    child.on("error", (err: any) => reject(err));
  });
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

async function runGitStd(
  args: string[]
): Promise<{ stdout: string; stderr: string; code: number }> {
  return runGit(withStandardGitArgs(args));
}

// 기능 감지를 단순화: help -a 파싱 없이 실행 결과 기반으로만 폴백 처리

export async function tryRunGitStd(
  args: string[]
): Promise<{ ok: boolean; stdout: string; stderr: string; code: number }> {
  const { stdout, stderr, code } = await runGitStd(args);
  return { ok: code === 0, stdout, stderr, code };
}

export async function getCurrentBranch(): Promise<string> {
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
}

export async function getGitConfigValue(key: string): Promise<string | null> {
  const { stdout, code } = await runGitStd(["config", "--get", key]);
  if (code !== 0) return null;
  const value = stdout.trim();
  return value.length > 0 ? value : null;
}

export async function getDefaultAuthorFromGitConfig(): Promise<{
  name: string | null;
  email: string | null;
}> {
  const [name, email] = await Promise.all([
    getGitConfigValue("user.name"),
    getGitConfigValue("user.email"),
  ]);
  return { name, email };
}

export async function assertInsideGitRepo(): Promise<void> {
  const { stdout, code } = await runGitStd([
    "rev-parse",
    "--is-inside-work-tree",
  ]);
  if (code !== 0 || stdout.trim() !== "true") {
    throw new Error(
      "The current directory is not a Git repository. Run git init or execute in a proper repository."
    );
  }
}

export async function getTodayDateString(): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function getCommitHashesSinceUntil(
  since?: string,
  until?: string,
  author?: { name?: string | null; email?: string | null }
): Promise<string[]> {
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
}

export async function getCommitHashesRange(
  fromExclusive: string | null,
  toInclusive: string = "HEAD",
  author?: { name?: string | null; email?: string | null }
): Promise<string[]> {
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
}

export async function getCommitMeta(hash: string): Promise<CommitMeta> {
  // %H hash, %an author, %ad author date (ISO-like), %s subject, %b body
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
}

export async function getCommitDiff(hash: string): Promise<string> {
  const { stdout, code, stderr } = await runGitStd([
    "show",
    "--patch",
    "--unified=0",
    hash,
  ]);
  if (code !== 0) throw new Error(`git show diff failed: ${stderr}`);
  return stdout;
}

export async function collectCommitsWithDiff(
  hashes: string[],
  limit?: number
): Promise<CommitWithDiff[]> {
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
}
