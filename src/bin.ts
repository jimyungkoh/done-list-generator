#!/usr/bin/env node
import { runCli } from "./cli.js";

// Dedicated bin entry that always runs CLI and handles errors centrally.
runCli(process.argv).catch((err) => {
  console.error(
    "[Error]",
    err instanceof Error ? err.message : String(err)
  );
  process.exitCode = 1;
});

