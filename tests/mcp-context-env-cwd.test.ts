import { assertEquals } from "@std/assert";
import { MCPContext } from "../main.ts";
import { dirname, fromFileUrl, join } from "@std/path";
import type { ITSExecuteOptions } from "../src/utils/ts-execute.util.ts";

const __dirname = dirname(fromFileUrl(import.meta.url));
const projectRoot = join(__dirname, "..");

Deno.test("MCPContext - Verify tools have the correct cwd", async () => {
  const tempDir = Deno.makeTempDirSync();
  const projectCwd = join(tempDir, "project-cwd");
  Deno.mkdirSync(projectCwd);

  const contextDir = join(tempDir, "context");
  Deno.mkdirSync(contextDir);

  try {
    const contextConfig = {
      name: "context",
      version: "1.0.0",
      description: "Context",
      author: "Author",
      tags: [],
    };
    Deno.writeTextFileSync(join(contextDir, "context.json"), JSON.stringify(contextConfig));
    Deno.writeTextFileSync(join(contextDir, "deno.json"), JSON.stringify({}));

    const toolsDir = join(contextDir, "tools");
    Deno.mkdirSync(toolsDir);
    Deno.writeTextFileSync(
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
      projectCwd: projectCwd,
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
    
    // On Windows, paths might have different separators or casing, but they should represent the same directory
    // Deno.cwd() might return a path with backslashes on Windows
    const normalizedResultCwd = (result as any).cwd.replace(/\\/g, "/").toLowerCase();
    const normalizedProjectCwd = projectCwd.replace(/\\/g, "/").toLowerCase();
    
    assertEquals(normalizedResultCwd, normalizedProjectCwd);
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});

Deno.test("MCPContext - Verify tools have access to requested environment variables", async () => {
  const tempDir = Deno.makeTempDirSync();
  const projectCwd = join(tempDir, "project-cwd");
  Deno.mkdirSync(projectCwd);

  const contextDir = join(tempDir, "context");
  Deno.mkdirSync(contextDir);

  // Set a test environment variable
  const TEST_VAR_NAME = "MCPB_TEST_VAR";
  const TEST_VAR_VALUE = "hello-world";
  Deno.env.set(TEST_VAR_NAME, TEST_VAR_VALUE);

  try {
    const contextConfig = {
      name: "context",
      version: "1.0.0",
      description: "Context",
      author: "Author",
      tags: [],
      typeScript: {
        allowedEnvironments: [TEST_VAR_NAME]
      }
    };
    Deno.writeTextFileSync(join(contextDir, "context.json"), JSON.stringify(contextConfig));
    Deno.writeTextFileSync(join(contextDir, "deno.json"), JSON.stringify({}));

    const toolsDir = join(contextDir, "tools");
    Deno.mkdirSync(toolsDir);
    Deno.writeTextFileSync(
      join(toolsDir, "env-tool.ts"),
      "export function toolMeta() { return { name: 'env_tool', description: 'd', inputSchema: { type: 'object' } }; } " +
      "export function toolHandler() { return { value: Deno.env.get('" + TEST_VAR_NAME + "') }; }"
    );

    const mcpContext = new MCPContext();
    const options: ITSExecuteOptions = {
      importsCwd: projectRoot,
      projectCwd: projectCwd,
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
    
    assertEquals((result as any).value, TEST_VAR_VALUE);
  } finally {
    Deno.env.delete(TEST_VAR_NAME);
    Deno.removeSync(tempDir, { recursive: true });
  }
});

Deno.test("MCPContext - Throw exception if required environment variables are missing", async () => {
  const tempDir = Deno.makeTempDirSync();
  const projectCwd = join(tempDir, "project-cwd");
  Deno.mkdirSync(projectCwd);

  const contextDir = join(tempDir, "context");
  Deno.mkdirSync(contextDir);

  const REQUIRED_VAR = "MISSING_REQUIRED_VAR";
  // Ensure it's not set
  Deno.env.delete(REQUIRED_VAR);

  try {
    const contextConfig = {
      name: "context",
      version: "1.0.0",
      description: "Context",
      author: "Author",
      tags: [],
      typeScript: {
        allowedEnvironments: [REQUIRED_VAR]
      }
    };
    Deno.writeTextFileSync(join(contextDir, "context.json"), JSON.stringify(contextConfig));
    Deno.writeTextFileSync(join(contextDir, "deno.json"), JSON.stringify({}));

    const mcpContext = new MCPContext();
    const options: ITSExecuteOptions = {
      importsCwd: projectRoot,
      projectCwd: projectCwd,
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

    const { assertRejects } = await import("@std/assert");
    await assertRejects(
      () => mcpContext.loadContext(contextDir, options),
      Error,
      `Environment variable \`${REQUIRED_VAR}\` is required but not set.`,
    );
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});
