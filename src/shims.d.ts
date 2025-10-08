// Minimal Node shims for editor linting without @types/node install
declare var process: any;

declare module "node:path" {
  export function join(...parts: string[]): string;
  export function dirname(p: string): string;
}

declare module "node:fs" {}

declare module "node:fs/promises" {
  export const readFile: any;
  export const writeFile: any;
  export const mkdir: any;
  export const stat: any;
}

declare module "node:child_process" {
  export function spawn(cmd: string, args?: string[], opts?: any): any;
}

declare module "node:os" {
  export const EOL: string;
}

declare module "node:util" {
  export const promisify: any;
}
