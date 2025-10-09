import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";

async function fileExists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function getHomeDir() {
  return process.env.HOME || process.env.USERPROFILE || "";
}

function getGlobalConfigPath() {
  const home = getHomeDir();
  if (!home) {
    return "";
  }
  if (process.platform === "win32") {
    return join(home, "AppData", "Local", "donelist", "donelist.json");
  }
  const xdgHome = process.env.XDG_CONFIG_HOME || join(home, ".config");
  return join(xdgHome, "donelist", "donelist.json");
}

async function ensureDefaultConfig() {
  const configPath = getGlobalConfigPath();
  if (!configPath) {
    return;
  }

  if (await fileExists(configPath)) {
    return;
  }

  const defaultConfig = {
    lang: "en",
    model: "",
    openrouterKey: "",
    verbose: false,
    trimDiffs: true,
  };

  const dir = dirname(configPath);
  await mkdir(dir, { recursive: true });

  // Use wx to avoid overwriting files that might have been created concurrently.
  await writeFile(configPath, `${JSON.stringify(defaultConfig, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  console.log(
    `[done-list-generator] Created default config file: ${configPath}`
  );
}

void ensureDefaultConfig().catch((error) => {
  const message =
    error && typeof error === "object" && "message" in error
      ? error.message
      : String(error);
  console.warn(
    `[done-list-generator] Failed to create default config file, but installation will continue: ${message}`
  );
});
