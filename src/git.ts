import { spawn } from "node:child_process";
import { CommitMeta, CommitWithDiff } from "./types.js";

function runGit(
  args: string[]
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }));
    child.on("error", (err) => reject(err));
  });
}

export async function assertInsideGitRepo(): Promise<void> {
  const { stdout, code } = await runGit(["rev-parse", "--is-inside-work-tree"]);
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
  until?: string
): Promise<string[]> {
  const args = [
    "-c",
    "core.quotepath=false",
    "--no-pager",
    "log",
    "--format=%H",
  ];
  if (since) args.push(`--since=${since}`);
  if (until) args.push(`--until=${until}`);
  const { stdout, code, stderr } = await runGit(args);
  if (code !== 0) {
    throw new Error(`git log failed: ${stderr}`);
  }
  return stdout.split(/\r?\n/).filter(Boolean);
}

export async function getCommitHashesRange(
  fromExclusive: string | null,
  toInclusive: string = "HEAD"
): Promise<string[]> {
  const range = fromExclusive
    ? `${fromExclusive}..${toInclusive}`
    : toInclusive;
  const args = [
    "-c",
    "core.quotepath=false",
    "--no-pager",
    "log",
    "--format=%H",
    range,
  ];
  const { stdout, code, stderr } = await runGit(args);
  if (code !== 0) throw new Error(`git log failed: ${stderr}`);
  return stdout.split(/\r?\n/).filter(Boolean);
}

export async function getCommitMeta(hash: string): Promise<CommitMeta> {
  // %H hash, %an author, %ad author date (ISO-like), %s subject, %b body
  const pretty = "%H%n%an%n%ai%n%s%n%b";
  const { stdout, code, stderr } = await runGit([
    "--no-pager",
    "--no-color",
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
  const { stdout, code, stderr } = await runGit([
    "-c",
    "core.quotepath=false",
    "--no-pager",
    "show",
    "--patch",
    "--unified=0",
    "--no-color",
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
