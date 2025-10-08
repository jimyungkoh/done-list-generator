import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const LAST_COMMIT_MARK = "lastProcessedCommit";

export function extractLastProcessedCommitFromMarkdown(
  content: string
): string | null {
  const m = content.match(
    new RegExp(`<!--\\s*${LAST_COMMIT_MARK}:\\s*([0-9a-fA-F]{6,40})\\s*-->`)
  );
  return m ? m[1] : null;
}

export function renderNewMarkdown(
  dateStr: string,
  language: string,
  latestCommit: string,
  body: string
): string {
  const header = `<!-- ${LAST_COMMIT_MARK}: ${latestCommit} -->\n# Done List - ${dateStr}\n\n## 요약\n\n`; // Summary is designed to be included in the LLM result body
  const tail = `\n`;
  return header + body + tail;
}

export function appendIncrementSection(
  existing: string,
  timeStr: string,
  body: string,
  latestCommit: string
): string {
  const updatedHead = existing.replace(
    new RegExp(`<!--\\s*${LAST_COMMIT_MARK}:[^>]*-->`),
    `<!-- ${LAST_COMMIT_MARK}: ${latestCommit} -->`
  );
  const append = `\n## 추가 업데이트 (${timeStr})\n\n${body}\n`;
  return updatedHead + append;
}

export async function readIfExists(filePath: string): Promise<string | null> {
  try {
    const s = await stat(filePath);
    if (!s.isFile()) return null;
    const buf = await readFile(filePath);
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

export async function ensureDirFor(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

export async function writeText(
  filePath: string,
  content: string
): Promise<void> {
  await ensureDirFor(filePath);
  await writeFile(filePath, content, "utf8");
}
