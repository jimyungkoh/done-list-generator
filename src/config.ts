import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { CliOptions } from "./types.js";

export interface AppConfig {
  lang?: string;
  model?: string;
  openrouterKey?: string;
  verbose?: boolean;
  trimDiffs?: boolean;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}

async function readJson<T = unknown>(filePath: string): Promise<T | null> {
  try {
    const buf = await readFile(filePath);
    const txt = buf.toString("utf8");
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

function getHomeDir(): string {
  return (process && (process.env.HOME || process.env.USERPROFILE)) || "";
}

function getGlobalConfigPath(): string {
  const home = getHomeDir();
  const isWin = process && process.platform === "win32";
  if (isWin) {
    return join(home, "AppData", "Local", "donelist", "donelist.json");
  }
  const xdg = (process && process.env.XDG_CONFIG_HOME) || join(home, ".config");
  return join(xdg, "donelist", "donelist.json");
}

function getCandidatePaths(cwd: string): string[] {
  return [
    join(cwd, ".donelist.json"),
    join(cwd, "donelist.json"),
    getGlobalConfigPath(),
  ];
}

export interface LoadedConfigResult {
  config: AppConfig;
  sourcePath: string | null;
}

export async function loadConfigFile(cwd: string): Promise<LoadedConfigResult> {
  const candidates = getCandidatePaths(cwd);
  for (const p of candidates) {
    // first match wins (higher priority)
    if (await fileExists(p)) {
      const obj = await readJson<AppConfig>(p);
      if (obj && typeof obj === "object") {
        return { config: obj, sourcePath: p };
      }
      // invalid JSON -> ignore gracefully for simplicity
      return { config: {}, sourcePath: p };
    }
  }
  return { config: {}, sourcePath: null };
}

export interface ResolvedConfig {
  lang: string; // default to "en"
  model?: string;
  openrouterKey: string; // may be empty string; upstream will validate
  verbose?: boolean;
  trimDiffs: boolean;
  configPath: string | null;
}

function getEnvLang(): string | undefined {
  const raw = process.env.DONELIST_LANG;
  return raw && raw.trim().length > 0 ? raw.trim() : undefined;
}

function getEnvModel(): string | undefined {
  const raw = process.env.DONELIST_MODEL;
  return raw && raw.trim().length > 0 ? raw.trim() : undefined;
}

function getEnvVerbose(): boolean | undefined {
  const raw = process.env.DONELIST_VERBOSE;
  if (raw === undefined) {
    return undefined;
  }
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "on"
  ) {
    return true;
  }
  if (
    normalized === "false" ||
    normalized === "0" ||
    normalized === "no" ||
    normalized === "off"
  ) {
    return false;
  }
  return undefined;
}

function getEnvTrimDiffs(): boolean | undefined {
  const raw = process.env.DONELIST_TRIM_DIFFS;
  if (raw === undefined) {
    return undefined;
  }
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "on"
  ) {
    return true;
  }
  if (
    normalized === "false" ||
    normalized === "0" ||
    normalized === "no" ||
    normalized === "off"
  ) {
    return false;
  }
  return undefined;
}

export async function resolveConfig(opts: CliOptions): Promise<ResolvedConfig> {
  const { config, sourcePath } = await loadConfigFile(process.cwd());

  const lang = opts.lang ?? config.lang ?? getEnvLang() ?? "en";
  const model = opts.model ?? config.model ?? getEnvModel();
  const verbose = opts.verbose ?? config.verbose ?? getEnvVerbose();
  const trimDiffs =
    opts.trimDiffs ?? config.trimDiffs ?? getEnvTrimDiffs() ?? true;
  const openrouterKey =
    opts.openrouterKey ??
    config.openrouterKey ??
    process.env.OPENROUTER_API_KEY ??
    "";

  return {
    lang,
    model,
    openrouterKey,
    verbose,
    trimDiffs,
    configPath: sourcePath,
  };
}
