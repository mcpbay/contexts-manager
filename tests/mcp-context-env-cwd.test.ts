import { expect, test } from "@libs/testing";
import { MCPContext } from "../main.ts";
import { join } from "@std/path";
import type { ITSExecuteOptions } from "../src/utils/ts-execute.util.ts";
import {
  cwd,
  envDelete,
  envSet,
  makeTempDirSync,
  mkdirSync,
  removeSync,
  writeTextFileSync,
} from "../src/utils/fs.util.ts";
import { DENO_PERMISSIONS } from "./constants.ts";

const projectRoot = cwd();

test("MCPContext - Verify tools have the correct cwd", async () => {
  const tempDir = makeTempDirSync();
  const projectCwdDir = join(tempDir, "project-cwd");

  mkdirSync(projectCwdDir);

  const contextDir = join(tempDir, "context");

  mkdirSync(contextDir);

  try {
    const contextConfig = {
      name: "context",
      version: "1.0.0",
      description: "Context",
      author: "Author",
      tags: [],
    };

    writeTextFileSync(
      join(contextDir, "context.json"),
      JSON.stringify(contextConfig),
    );
    writeTextFileSync(join(contextDir, "deno.json"), JSON.stringify({}));

    const toolsDir = join(contextDir, "tools");

    mkdirSync(toolsDir);
    writeTextFileSync(
      join(toolsDir, "cwd-tool.ts"),
      `
      export function toolMeta() {
        return {
          name: "cwd_tool",
          description: "Get current CWD",
          inputSchema: { type: "object", properties: {} }
        };
      }
      export function toolHandler() {
        return { cwd: Deno.cwd() };
      }
      `,
    );

    const mcpContext = new MCPContext();
    const options: ITSExecuteOptions = {
      importsCwd: projectRoot,
      projectCwd: projectCwdDir,
      permissions: {
        allowedReadDirs: [tempDir, projectRoot],
        allowedWriteDirs: [],
        allowNetDomains: [],
        allowedPackages: [],
        allowedExecutables: [],
        allowedEnvironments: [],
      },
      extraArguments: [],
      timeout: 30000,
    };

    await mcpContext.loadContext(contextDir, options);
    const result = await mcpContext.executeTool("cwd_tool", {}, options);

      // deno-lint-ignore no-explicit-any
    const normalizedResultCwd = (result as any).cwd.replace(/\\/g, "/")
      .toLowerCase();
    const normalizedProjectCwd = projectCwdDir.replace(/\\/g, "/")
      .toLowerCase();

    expect(normalizedResultCwd).toBe(normalizedProjectCwd);
  } finally {
    removeSync(tempDir);
  }
}, DENO_PERMISSIONS);

test(
  "MCPContext - Verify tools have access to requested environment variables",
  async () => {
    const tempDir = makeTempDirSync();
    const projectCwdDir = join(tempDir, "project-cwd");

    mkdirSync(projectCwdDir);

    const contextDir = join(tempDir, "context");

    mkdirSync(contextDir);

    const TEST_VAR_NAME = "MCPB_TEST_VAR";
    const TEST_VAR_VALUE = "hello-world";

    envSet(TEST_VAR_NAME, TEST_VAR_VALUE);

    try {
      const contextConfig = {
        name: "context",
        version: "1.0.0",
        description: "Context",
        author: "Author",
        tags: [],
        typeScript: {
          allowedEnvironments: [TEST_VAR_NAME],
        },
      };

      writeTextFileSync(
        join(contextDir, "context.json"),
        JSON.stringify(contextConfig),
      );
      writeTextFileSync(join(contextDir, "deno.json"), JSON.stringify({}));

      const toolsDir = join(contextDir, "tools");

      mkdirSync(toolsDir);
      writeTextFileSync(
        join(toolsDir, "env-tool.ts"),
        "export function toolMeta() { return { name: 'env_tool', description: 'd', inputSchema: { type: 'object' } }; } " +
          "export function toolHandler() { return { value: Deno.env.get('" +
          TEST_VAR_NAME + "') }; }",
      );

      const mcpContext = new MCPContext();
      const options: ITSExecuteOptions = {
        importsCwd: projectRoot,
        projectCwd: projectCwdDir,
        permissions: {
          allowedReadDirs: [tempDir, projectRoot],
          allowedWriteDirs: [],
          allowNetDomains: [],
          allowedPackages: [],
          allowedExecutables: [],
          allowedEnvironments: [TEST_VAR_NAME],
        },
        extraArguments: [],
        timeout: 30000,
      };

      await mcpContext.loadContext(contextDir, options);
      const result = await mcpContext.executeTool("env_tool", {}, options);

      // deno-lint-ignore no-explicit-any
      expect((result as any).value).toBe(TEST_VAR_VALUE);
    } finally {
      envDelete(TEST_VAR_NAME);
      removeSync(tempDir);
    }
  },
  DENO_PERMISSIONS,
);

test(
  "MCPContext - Throw exception if required environment variables are missing",
  async () => {
    const tempDir = makeTempDirSync();
    const projectCwdDir = join(tempDir, "project-cwd");

    mkdirSync(projectCwdDir);

    const contextDir = join(tempDir, "context");

    mkdirSync(contextDir);

    const REQUIRED_VAR = "MISSING_REQUIRED_VAR";

    envDelete(REQUIRED_VAR);

    try {
      const contextConfig = {
        name: "context",
        version: "1.0.0",
        description: "Context",
        author: "Author",
        tags: [],
        typeScript: {
          allowedEnvironments: [REQUIRED_VAR],
        },
      };

      writeTextFileSync(
        join(contextDir, "context.json"),
        JSON.stringify(contextConfig),
      );
      writeTextFileSync(join(contextDir, "deno.json"), JSON.stringify({}));

      const mcpContext = new MCPContext();
      const options: ITSExecuteOptions = {
        importsCwd: projectRoot,
        projectCwd: projectCwdDir,
        permissions: {
          allowedReadDirs: [tempDir, projectRoot],
          allowedWriteDirs: [],
          allowNetDomains: [],
          allowedPackages: [],
          allowedExecutables: [],
          allowedEnvironments: [REQUIRED_VAR],
        },
        extraArguments: [],
        timeout: 30000,
      };

      await expect(mcpContext.loadContext(contextDir, options)).rejects.toThrow(
        `Environment variable \`${REQUIRED_VAR}\` is required but not set.`,
      );
    } finally {
      removeSync(tempDir);
    }
  },
  DENO_PERMISSIONS,
);
