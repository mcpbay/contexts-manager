import { expect, test } from "@libs/testing";
import { join } from "@std/path";
import { MCPContext } from "../main.ts";
import type { ITSExecuteOptions } from "../src/utils/ts-execute.util.ts";
import { makeTempDirSync, mkdirSync, removeSync, writeTextFileSync } from "../src/utils/fs.util.ts";
import { DENO_PERMISSIONS } from "./constants.ts";

const projectRoot = "E:\\Git\\profit\\node\\mcpbay\\mcpbay-mcpb-core";

test("MCPContext - Exhaustive Execution: Tool with complex input validation", async () => {
  const tempDir = makeTempDirSync();
  const contextDir = join(tempDir, "context");

  mkdirSync(contextDir);
  mkdirSync(join(contextDir, "tools"));

  try {
    writeTextFileSync(
      join(contextDir, "context.json"),
      JSON.stringify({
        name: "test",
        version: "1",
        description: "d",
        author: "a",
        tags: [],
      }),
    );
    writeTextFileSync(join(contextDir, "deno.json"), JSON.stringify({}));

    const toolContent = `
      export function toolMeta() {
        return {
          name: "validate_me",
          description: "d",
          inputSchema: {
            type: "object",
            properties: {
              email: { type: "string", format: "email" },
              age: { type: "number", minimum: 18 }
            },
            required: ["email", "age"]
          }
        };
      }
      export function toolHandler(args: any) {
        return { success: true, args };
      }
    `;

    writeTextFileSync(join(contextDir, "tools", "tool.ts"), toolContent);

    const mcpContext = new MCPContext();
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

    await mcpContext.loadContext(contextDir, options);

    const res1 = await mcpContext.executeTool("validate_me", {
      email: "test@example.com",
      age: 20,
    }, options);

    expect((res1 as any).success).toBe(true);
  } finally {
    removeSync(tempDir);
  }
}, DENO_PERMISSIONS);

test("MCPContext - Exhaustive Execution: Tool returning non-object", async () => {
  const tempDir = makeTempDirSync();
  const contextDir = join(tempDir, "context");

  mkdirSync(contextDir);
  mkdirSync(join(contextDir, "tools"));

  try {
    writeTextFileSync(
      join(contextDir, "context.json"),
      JSON.stringify({
        name: "test",
        version: "1",
        description: "d",
        author: "a",
        tags: [],
      }),
    );
    writeTextFileSync(join(contextDir, "deno.json"), JSON.stringify({}));
    writeTextFileSync(
      join(contextDir, "tools", "tool.ts"),
      `
      export function toolMeta() { return { name: "return_string", description: "d", inputSchema: { type: "object", properties: {} } }; }
      export function toolHandler() { return "I am a string, not an object"; }
    `,
    );

    const mcpContext = new MCPContext();
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

    await mcpContext.loadContext(contextDir, options);
    const res = await mcpContext.executeTool("return_string", {}, options);

    expect(res as any).toBe("I am a string, not an object");
  } finally {
    removeSync(tempDir);
  }
}, DENO_PERMISSIONS);

test("MCPContext - Exhaustive Execution: Resource returning non-string", async () => {
  const tempDir = makeTempDirSync();
  const contextDir = join(tempDir, "context");

  mkdirSync(contextDir);
  mkdirSync(join(contextDir, "resources"));

  try {
    writeTextFileSync(
      join(contextDir, "context.json"),
      JSON.stringify({
        name: "test",
        version: "1",
        description: "d",
        author: "a",
        tags: [],
      }),
    );
    writeTextFileSync(join(contextDir, "deno.json"), JSON.stringify({}));
    writeTextFileSync(
      join(contextDir, "resources", "res.ts"),
      `
      export function resourceMeta() { return { name: "res", description: "d", mimeType: "text/plain" }; }
      export function resourceHandler() { return { not: "a string" }; }
    `,
    );

    const mcpContext = new MCPContext();
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

    await mcpContext.loadContext(contextDir, options);
    await expect(mcpContext.readResource("res", options)).rejects.toThrow("did not return a string");
  } finally {
    removeSync(tempDir);
  }
}, DENO_PERMISSIONS);

test("MCPContext - Exhaustive Execution: Tool handler failure", async () => {
  const tempDir = makeTempDirSync();
  const contextDir = join(tempDir, "context");

  mkdirSync(contextDir);
  mkdirSync(join(contextDir, "tools"));

  try {
    writeTextFileSync(
      join(contextDir, "context.json"),
      JSON.stringify({
        name: "test",
        version: "1",
        description: "d",
        author: "a",
        tags: [],
      }),
    );
    writeTextFileSync(join(contextDir, "deno.json"), JSON.stringify({}));
    writeTextFileSync(
      join(contextDir, "tools", "fail.ts"),
      `
      export function toolMeta() { return { name: "fail", description: "d", inputSchema: { type: "object", properties: {} } }; }
      export function toolHandler() { throw new Error("Intentional failure"); }
    `,
    );

    const mcpContext = new MCPContext();
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

    await mcpContext.loadContext(contextDir, options);
    await expect(mcpContext.executeTool("fail", {}, options)).rejects.toThrow("Intentional failure");
  } finally {
    removeSync(tempDir);
  }
}, DENO_PERMISSIONS);
