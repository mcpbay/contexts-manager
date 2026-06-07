import { expect, test } from "@libs/testing";
import { join } from "@std/path";
import type { ITSExecuteOptions } from "../src/utils/ts-execute.util.ts";
import { prepareContext } from "../src/mod.ts";
import { envDelete, envSet, makeTempDirSync, mkdirSync, removeSync, writeTextFileSync } from "../src/utils/fs.util.ts";
import { DENO_PERMISSIONS } from "./constants.ts";

const projectRoot = "E:\\Git\\profit\\node\\mcpbay\\mcpbay-mcpb-core";

test("prepareContext - Exhaustive Config: Optional typeScript fields", async () => {
  envSet("TEST_VAR", "value");
  const tempDir = makeTempDirSync();

  try {
    const contextConfig = {
      name: "full-context",
      version: "1.2.3",
      description: "A full context",
      author: "Exhaustive Tester",
      tags: ["test", "exhaustive"],
      typeScript: {
        allowedPackages: ["jsr:@std/assert"],
        allowedExecutables: ["deno"],
        allowedNetDomains: ["example.com"],
        allowedEnvironments: ["TEST_VAR"],
        allowRead: true,
        allowWrite: false,
        extraArguments: ["--allow-all"],
      },
    };

    writeTextFileSync(
      join(tempDir, "context.json"),
      JSON.stringify(contextConfig),
    );
    writeTextFileSync(join(tempDir, "deno.json"), JSON.stringify({}));

    const options: ITSExecuteOptions = {
      importsCwd: projectRoot,
      projectCwd: projectRoot,
      permissions: {
        allowedReadDirs: [tempDir, projectRoot],
        allowedWriteDirs: [tempDir],
        allowNetDomains: [],
        allowedPackages: [],
        allowedExecutables: [],
        allowedEnvironments: [],
      },
      extraArguments: [],
      timeout: 30000,
    };

    const response = await prepareContext(tempDir, options);

    expect(response).toBeTruthy();
    expect(response.resources.length).toBe(0);
    expect(response.tools.length).toBe(0);
  } finally {
    envDelete("TEST_VAR");
    removeSync(tempDir);
  }
}, DENO_PERMISSIONS);

test("prepareContext - Exhaustive Config: Invalid fields with defaults (.catch)", async () => {
  const tempDir = makeTempDirSync();

  try {
    const contextConfig = {
      description: 123,
      author: true,
      tags: ["valid"],
    };

    writeTextFileSync(
      join(tempDir, "context.json"),
      JSON.stringify(contextConfig),
    );

    const options: ITSExecuteOptions = {
      importsCwd: projectRoot,
      projectCwd: projectRoot,
      permissions: {
        allowedReadDirs: [tempDir],
        allowedWriteDirs: [],
        allowNetDomains: [],
        allowedPackages: [],
        allowedExecutables: [],
        allowedEnvironments: [],
      },
      extraArguments: [],
      timeout: 5000,
    };

    const response = await prepareContext(tempDir, options);

    expect(response).toBeTruthy();
  } finally {
    removeSync(tempDir);
  }
}, DENO_PERMISSIONS);

test("prepareContext - Exhaustive Resource: Markdown with complex metadata", async () => {
  const tempDir = makeTempDirSync();
  const resourcesDir = join(tempDir, "resources");

  try {
    mkdirSync(resourcesDir);
    const contextConfig = {
      name: "res-test",
      version: "1",
      description: "d",
      author: "a",
      tags: [],
    };

    writeTextFileSync(
      join(tempDir, "context.json"),
      JSON.stringify(contextConfig),
    );

    const mdContent = `---
name: complex-resource
description: A very complex description that should be parsed correctly even with weird characters like @#$%^&*()
title: Complex Title
mimeType: application/json
extraField: this should be ignored by the schema but not crash the parser
---
# Content`;

    writeTextFileSync(join(resourcesDir, "complex.md"), mdContent);

    const options: ITSExecuteOptions = {
      importsCwd: projectRoot,
      projectCwd: projectRoot,
      permissions: {
        allowedReadDirs: [tempDir],
        allowedWriteDirs: [],
        allowNetDomains: [],
        allowedPackages: [],
        allowedExecutables: [],
        allowedEnvironments: [],
      },
      extraArguments: [],
      timeout: 5000,
    };

    const response = await prepareContext(tempDir, options);
    const res = response.resources.find((r) => r.name === "complex-resource");

    expect(res).toBeTruthy();
    expect(res!.mimeType).toBe("application/json");
    expect(res!.title).toBe("Complex Title");
  } finally {
    removeSync(tempDir);
  }
}, DENO_PERMISSIONS);

test("prepareContext - Exhaustive Tool: inputSchema and outputSchema validation", async () => {
  const tempDir = makeTempDirSync();
  const toolsDir = join(tempDir, "tools");

  try {
    mkdirSync(toolsDir);
    const contextConfig = {
      name: "tool-test",
      version: "1",
      description: "d",
      author: "a",
      tags: [],
    };

    writeTextFileSync(
      join(tempDir, "context.json"),
      JSON.stringify(contextConfig),
    );
    writeTextFileSync(join(tempDir, "deno.json"), JSON.stringify({}));

    const tsToolContent = `
      export function toolMeta() {
        return {
          name: "complex_tool",
          description: "A tool with schemas",
          inputSchema: {
            type: "object",
            properties: {
              foo: { type: "string" },
              bar: { type: "number" }
            },
            required: ["foo"]
          },
          outputSchema: {
            type: "object",
            properties: {
              result: { type: "boolean" }
            }
          }
        };
      }
    `;

    writeTextFileSync(join(toolsDir, "complex.ts"), tsToolContent);

    const options: ITSExecuteOptions = {
      importsCwd: projectRoot,
      projectCwd: projectRoot,
      permissions: {
        allowedReadDirs: [tempDir, projectRoot],
        allowedWriteDirs: [tempDir],
        allowNetDomains: [],
        allowedPackages: [],
        allowedExecutables: [],
        allowedEnvironments: [],
      },
      extraArguments: [],
      timeout: 30000,
    };

    const response = await prepareContext(tempDir, options);
    const tool = response.tools.find((t) => t.name === "complex_tool");

    expect(tool).toBeTruthy();
    expect(tool!.inputSchema).toBeTruthy();
    expect(tool!.outputSchema).toBeTruthy();
    expect((tool!.inputSchema as any).required).toEqual(["foo"]);
  } finally {
    removeSync(tempDir);
  }
}, DENO_PERMISSIONS);

test("prepareContext - Exhaustive Tool: Name transformation to snake_case", async () => {
  const tempDir = makeTempDirSync();
  const toolsDir = join(tempDir, "tools");

  try {
    mkdirSync(toolsDir);
    const contextConfig = {
      name: "tool-test",
      version: "1",
      description: "d",
      author: "a",
      tags: [],
    };

    writeTextFileSync(
      join(tempDir, "context.json"),
      JSON.stringify(contextConfig),
    );
    writeTextFileSync(join(tempDir, "deno.json"), JSON.stringify({}));

    const tsToolContent = `
      export function toolMeta() {
        return {
          name: "My Awesome Tool",
          description: "Testing transformation",
          inputSchema: { type: "object", properties: {} }
        };
      }
    `;

    writeTextFileSync(join(toolsDir, "transform.ts"), tsToolContent);

    const options: ITSExecuteOptions = {
      importsCwd: projectRoot,
      projectCwd: projectRoot,
      permissions: {
        allowedReadDirs: [tempDir, projectRoot],
        allowedWriteDirs: [tempDir],
        allowNetDomains: [],
        allowedPackages: [],
        allowedExecutables: [],
        allowedEnvironments: [],
      },
      extraArguments: [],
      timeout: 30000,
    };

    const response = await prepareContext(tempDir, options);
    const tool = response.tools.find((t) => t.name === "my_awesome_tool");

    expect(tool).toBeTruthy();
  } finally {
    removeSync(tempDir);
  }
}, DENO_PERMISSIONS);
