import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as cp from "node:child_process";
import { Buffer } from "node:buffer";
import { getRuntime, Runtime } from "@online/runtime";
import { randomUUID } from "node:crypto";
import { TEMP_FILES_PREFIX } from "../constants/temp-files-prefix.constant.ts";

let tempCounter = 0;

export function statSync(filePath: string) {
  return fs.statSync(filePath);
}

export function writeFileSync(filePath: string, data: string | Uint8Array) {
  fs.writeFileSync(filePath, data);
}

export function mkdirSync(dir: string, options?: fs.MakeDirectoryOptions) {
  fs.mkdirSync(dir, { recursive: true, ...options });
}

export interface IDirEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
}

export function readDirSync(resolvedPath: string) {
  const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
  const dirEntries = entries.map((entry) => ({
    name: entry.name,
    isFile: entry.isFile(),
    isDirectory: entry.isDirectory(),
    isSymlink: entry.isSymbolicLink(),
  }));

  return dirEntries;
}

export interface IMakeTempFileSyncOptions {
  dirPath: string;
  content: string | NodeJS.ArrayBufferView;
}

export function makeTempFileSync(suffix: string, options?: Partial<IMakeTempFileSyncOptions>) {
  const uniqueId = randomUUID();
  const baseDir = options?.dirPath ?? os.tmpdir();
  const filePath = path.join(baseDir, `${TEMP_FILES_PREFIX}-${uniqueId}.${suffix}`);

  fs.writeFileSync(filePath, options?.content ?? "", "utf-8");

  return filePath;
}

export function writeTextFileSync(filePath: string, content: string) {
  fs.writeFileSync(filePath, content, "utf-8");
}

export async function readTextFile(filePath: string) {
  const content = await fs.promises.readFile(filePath, "utf-8");

  return content;
}

export function readTextFileSync(filePath: string) {
  return fs.readFileSync(filePath, "utf-8");
}

export function makeTempDirSync() {
  const uniqueId = `${Date.now()}-${++tempCounter}-${Math.random().toString(36).slice(2, 8)
    }`;
  const dirPath = path.join(os.tmpdir(), `mcpb-${uniqueId}`);

  fs.mkdirSync(dirPath);

  return dirPath;
}

export function removeSync(filePath: string) {
  fs.rmSync(filePath, { recursive: true, force: true });
}

export function cwd() {
  return process.cwd();
}

export function envGet(key: string) {
  return process.env[key];
}

export function envHas(key: string) {
  return key in process.env;
}

export function envSet(key: string, value: string) {
  process.env[key] = value;
}

export function envDelete(key: string) {
  delete process.env[key];
}

const __isDeno = getRuntime() === Runtime.Deno;

export function createDenoCommand(
  args: string[],
  options: { cwd?: string | URL; },
) {
  if (__isDeno) {
    return createDenoCommandOnDeno(args, options);
  }

  return createDenoCommandOnNode(args, options);
}

function createDenoCommandOnDeno(
  args: string[],
  options: { cwd?: string | URL; },
) {
  const command = new Deno.Command("deno", {
    args,
    cwd: options.cwd?.toString(),
    stderr: "piped",
    stdout: "piped",
    stdin: "null",
  });

  return {
    spawn() {
      const child = command.spawn();

      return {
        kill(signal?: string) {
          try {
            child.kill(signal as Deno.Signal);
          } catch {
            // empty
          }
        },
        output() {
          return child.output();
        },
      };
    },
  };
}

function createDenoCommandOnNode(
  args: string[],
  options: { cwd?: string | URL; },
) {
  return {
    spawn() {
      const child = cp.spawn("deno", args, {
        cwd: options.cwd?.toString(),
        stdio: ["ignore", "pipe", "pipe"],
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout?.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

      return {
        kill(signal?: string) {
          try {
            child.kill(signal as NodeJS.Signals);
          } catch {
            // empty
          }
        },
        output(): Promise<{
          success: boolean;
          stdout: Uint8Array;
          stderr: Uint8Array;
        }> {
          return new Promise((resolve) => {
            child.on("close", (code) => {
              const result = {
                success: code === 0,
                stdout: new Uint8Array(Buffer.concat(stdoutChunks)),
                stderr: new Uint8Array(Buffer.concat(stderrChunks)),
              };

              resolve(result);
            });
            child.on("error", () => {
              const result = {
                success: false,
                stdout: new Uint8Array(),
                stderr: new Uint8Array(Buffer.concat(stderrChunks)),
              };

              resolve(result);
            });
          });
        },
      };
    },
  };
}
