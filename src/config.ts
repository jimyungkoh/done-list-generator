import {
  readFile as defaultReadFile,
  stat as defaultStat,
} from "node:fs/promises";
import { join } from "node:path";
import type { CliOptions, OutputMode } from "./types.js";

export interface AppConfig {
  lang?: string;
  model?: string;
  openrouterKey?: string;
  verbose?: boolean;
  trimDiffs?: boolean;
  mode?: OutputMode;
}

export interface LoadedConfigResult {
  config: AppConfig;
  sourcePath: string | null;
}

export interface ResolvedConfig {
  lang: string;
  model?: string;
  openrouterKey: string;
  verbose?: boolean;
  trimDiffs: boolean;
  configPath: string | null;
  mode: OutputMode;
}

export interface ConfigFileSystem {
  readFile: typeof defaultReadFile;
  stat: typeof defaultStat;
}

export interface ConfigContext {
  cwd?: string;
  env?: Record<string, string | undefined>;
  platform?: string;
  fs?: Partial<ConfigFileSystem>;
}

function isTruthyBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

function isFalsyBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "false" ||
    normalized === "0" ||
    normalized === "no" ||
    normalized === "off"
  );
}

function resolveBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (isTruthyBoolean(value)) return true;
  if (isFalsyBoolean(value)) return false;
  return undefined;
}

export interface ConfigResolver {
  loadConfigFile(cwdOverride?: string): Promise<LoadedConfigResult>;
  resolveConfig(opts: CliOptions): Promise<ResolvedConfig>;
}

export function createConfigResolver(
  context: ConfigContext = {}
): ConfigResolver {
  const env: Record<string, string | undefined> = context.env ?? process.env;
  const platform = context.platform ?? process.platform;
  const cwd = context.cwd ?? process.cwd();
  const readFile = context.fs?.readFile ?? defaultReadFile;
  const stat = context.fs?.stat ?? defaultStat;

  const fileExists = async (filePath: string): Promise<boolean> => {
    try {
      const s = await stat(filePath);
      return s.isFile();
    } catch {
      return false;
    }
  };

  const readJson = async <T = unknown>(filePath: string): Promise<T | null> => {
    try {
      const buf = await readFile(filePath);
      const txt = buf.toString("utf8");
      return JSON.parse(txt) as T;
    } catch {
      return null;
    }
  };

  const getHomeDir = (): string => {
    return env.HOME || env.USERPROFILE || "";
  };

  const getGlobalConfigPath = (): string => {
    const home = getHomeDir();
    if (!home) return "";
    if (platform === "win32") {
      return join(home, "AppData", "Local", "donelist", "donelist.json");
    }
    const xdg = env.XDG_CONFIG_HOME || join(home, ".config");
    return join(xdg, "donelist", "donelist.json");
  };

  const getCandidatePaths = (baseCwd: string): string[] => {
    const candidates = [
      join(baseCwd, ".donelist.json"),
      join(baseCwd, "donelist.json"),
    ];
    const globalPath = getGlobalConfigPath();
    if (globalPath) {
      candidates.push(globalPath);
    }
    return candidates;
  };

  const loadConfigFile = async (
    cwdOverride?: string
  ): Promise<LoadedConfigResult> => {
    const searchCwd = cwdOverride ?? cwd;
    const candidates = getCandidatePaths(searchCwd);
    for (const candidate of candidates) {
      if (await fileExists(candidate)) {
        const obj = await readJson<AppConfig>(candidate);
        if (obj && typeof obj === "object") {
          return { config: obj, sourcePath: candidate };
        }
        return { config: {}, sourcePath: candidate };
      }
    }
    return { config: {}, sourcePath: null };
  };

  const getEnvLang = (): string | undefined => {
    const raw = env.DONELIST_LANG;
    return raw && raw.trim().length > 0 ? raw.trim() : undefined;
  };

  const getEnvModel = (): string | undefined => {
    const raw = env.DONELIST_MODEL;
    return raw && raw.trim().length > 0 ? raw.trim() : undefined;
  };

  const getEnvVerbose = (): boolean | undefined =>
    resolveBooleanEnv(env.DONELIST_VERBOSE);

  const getEnvTrimDiffs = (): boolean | undefined =>
    resolveBooleanEnv(env.DONELIST_TRIM_DIFFS);

  const getEnvMode = (): OutputMode | undefined => {
    const raw = env.DONELIST_MODE;
    if (!raw) return undefined;
    const v = raw.trim().toLowerCase();
    return v === "summary" || v === "detailed" ? (v as OutputMode) : undefined;
  };

  const resolveConfigInner = async (
    opts: CliOptions
  ): Promise<ResolvedConfig> => {
    const { config, sourcePath } = await loadConfigFile();

    // Normalize empty strings as undefined for correct fallback
    const nonEmpty = (v?: string): string | undefined =>
      v && v.trim().length > 0 ? v.trim() : undefined;

    // Precedence: CLI > Config > ENV > Defaults
    const lang =
      nonEmpty(opts.lang) ?? nonEmpty(config.lang) ?? getEnvLang() ?? "en";
    const model =
      nonEmpty(opts.model) ?? nonEmpty(config.model) ?? getEnvModel();
    const verbose =
      opts.verbose ??
      (config.verbose as boolean | undefined) ??
      getEnvVerbose();
    const trimDiffs =
      opts.trimDiffs ?? (config.trimDiffs ?? getEnvTrimDiffs() ?? true);
    const openrouterKey =
      nonEmpty(opts.openrouterKey) ??
      nonEmpty(config.openrouterKey) ??
      nonEmpty(env.OPENROUTER_API_KEY) ??
      "";

    const mode: OutputMode =
      (nonEmpty(opts.mode) as OutputMode | undefined) ??
      (config.mode as OutputMode | undefined) ??
      getEnvMode() ??
      "summary";

    return {
      lang,
      model,
      openrouterKey,
      verbose,
      trimDiffs,
      configPath: sourcePath,
      mode,
    };
  };

  return {
    loadConfigFile,
    resolveConfig: resolveConfigInner,
  };
}

const defaultResolver = createConfigResolver();

export const loadConfigFile = defaultResolver.loadConfigFile;
export const resolveConfig = defaultResolver.resolveConfig;
