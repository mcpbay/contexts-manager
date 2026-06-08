import { expect, test } from "@libs/testing";
import { join } from "@std/path";
import { createEmptyContext } from "../main.ts";
import {
  makeTempDirSync,
  makeTempFileSync,
  readTextFileSync,
  removeSync,
  statSync,
} from "../src/utils/fs.util.ts";
import { DENO_PERMISSIONS } from "./constants.ts";

test("createEmptyContext - Success: Creates initial structure", () => {
  const tmpDir = makeTempDirSync();

  try {
    createEmptyContext(tmpDir);

    const contextJsonPath = join(tmpDir, "context.json");
    const denoJsonPath = join(tmpDir, "deno.json");
    const isContextJsonExists = statSync(contextJsonPath) !== undefined;
    const isDenoJsonExists = statSync(denoJsonPath) !== undefined;

    expect(isContextJsonExists).toBe(true);
    expect(isDenoJsonExists).toBe(true);

    const isToolsDirExists = statSync(join(tmpDir, "tools")) !== undefined;
    const isResourcesDirExists =
      statSync(join(tmpDir, "resources")) !== undefined;
    const isPromptsDirExists = statSync(join(tmpDir, "prompts")) !== undefined;

    expect(isToolsDirExists).toBe(true);
    expect(isResourcesDirExists).toBe(true);
    expect(isPromptsDirExists).toBe(true);

    const isConceptMdExists =
      statSync(join(tmpDir, "resources", "CONCEPT.md")) !== undefined;
    const isConceptTsExists =
      statSync(join(tmpDir, "resources", "CONCEPT.ts")) !== undefined;

    expect(isConceptMdExists).toBe(true);
    expect(isConceptTsExists).toBe(true);

    const isHelloTsExists =
      statSync(join(tmpDir, "tools", "hello.ts")) !== undefined;

    expect(isHelloTsExists).toBe(true);

    const contextJson = JSON.parse(readTextFileSync(contextJsonPath));

    expect(contextJson.version).toBe("1.0.0");
    expect(contextJson.description).toBe("A useful context for MCPBay!");

    const denoJson = JSON.parse(readTextFileSync(denoJsonPath));

    expect(denoJson.imports["@std/assert"]).toBeTruthy();
    expect(denoJson.imports["zod"]).toBeTruthy();
  } finally {
    removeSync(tmpDir);
  }
}, DENO_PERMISSIONS);

test("createEmptyContext - Failure: Path is an existing file", () => {
  const tmpFile = makeTempFileSync("ts");

  try {
    try {
      createEmptyContext(tmpFile);

      throw new Error("Should have thrown");
    } catch (e) {
      expect(e).toBeTruthy();
    }
  } finally {
    removeSync(tmpFile);
  }
}, DENO_PERMISSIONS);

test("createEmptyContext - Success: Directory already exists", () => {
  const tmpDir = makeTempDirSync();

  try {
    createEmptyContext(tmpDir);
    createEmptyContext(tmpDir);

    const isContextJsonExists =
      statSync(join(tmpDir, "context.json")) !== undefined;

    expect(isContextJsonExists).toBe(true);
  } finally {
    removeSync(tmpDir);
  }
}, DENO_PERMISSIONS);
