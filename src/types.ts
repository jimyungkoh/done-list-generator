export type LanguageCode = "ko" | "en" | string;

export type OutputMode = "summary" | "detailed";

export interface CliOptions {
  lang?: LanguageCode;
  model?: string;
  openrouterKey?: string;
  dryRun?: boolean;
  since?: string; // ISO string example: 2025-10-10
  until?: string; // ISO string example: 2025-10-10
  verbose?: boolean;
  trimDiffs?: boolean;
  author?: string;
  authorEmail?: string;
  mode?: OutputMode;
}

export interface CommitMeta {
  hash: string;
  authorName: string;
  authorDate: string; // ISO or raw git date
  subject: string;
  body: string;
}

export interface CommitWithDiff {
  meta: CommitMeta;
  diff: string; // raw unified diff (possibly trimmed)
}

export interface GeneratedMarkdown {
  content: string;
  latestProcessedCommit: string | null;
}

export interface OpenRouterRequest {
  model?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface OpenRouterResponseChoice {
  message: { role: string; content: string };
}

export interface OpenRouterResponse {
  choices: OpenRouterResponseChoice[];
}
