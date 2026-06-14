import { expect, test } from "@libs/testing";
import { join } from "@std/path";
import { MCPContext, isContextProjectFolder } from "../main.ts";
import { prepareContext } from "../src/mod.ts";
import type { ITSExecuteOptions } from "../src/utils/deno-run.util.ts";
import {
  cwd,
  makeTempDirSync,
  readTextFileSync,
  removeSync,
  statSync,
} from "../src/utils/fs.util.ts";
import { DENO_PERMISSIONS } from "./constants.ts";

const projectRoot = cwd();
const contextProjectDir = join(projectRoot, "context");

const baseOptions: ITSExecuteOptions = {
  importsCwd: projectRoot,
  projectCwd: projectRoot,
  permissions: {
    allowedReadDirs: [contextProjectDir, projectRoot],
    allowedWriteDirs: [],
    allowNetDomains: [],
    allowedPackages: ["npm:zod"],
    allowedExecutables: [],
    allowedEnvironments: [],
  },
  extraArguments: [],
  timeout: 30000,
  configFilePath: join(contextProjectDir, "deno.json"),
};

test(
  "Context project - isContextProjectFolder returns true for context directory",
  () => {
    const result = isContextProjectFolder(contextProjectDir);

    expect(result).toBe(true);
  },
  DENO_PERMISSIONS,
);

test(
  "Context project - isContextProjectFolder returns false for non-context directory",
  () => {
    const result = isContextProjectFolder(projectRoot);

    expect(result).toBe(false);
  },
  DENO_PERMISSIONS,
);

test(
  "Context project - context.json exists and has valid structure",
  () => {
    const configPath = join(contextProjectDir, "context.json");
    const config = JSON.parse(readTextFileSync(configPath));

    expect(config.name).toBe("contexts-manager-api-reference");
    expect(config.version).toBe("1.0.0");
    expect(config.description).toBeTruthy();
    expect(config.author).toBe("mcpbay");
    expect(config.tags).toBeInstanceOf(Array);
  },
  DENO_PERMISSIONS,
);

test(
  "Context project - prepareContext loads all tools, resources, prompts, and agents",
  async () => {
    const response = await prepareContext(contextProjectDir, baseOptions);

    expect(response.tools.length).toBe(1);
    expect(response.resources.length).toBe(2);
    expect(response.prompts.length).toBe(1);
    expect(response.agents.length).toBeGreaterThan(0);
    expect(response.agents).toContain("@mcpbay/contexts-manager");
  },
  DENO_PERMISSIONS,
);

test(
  "Context project - Resources have correct metadata",
  async () => {
    const response = await prepareContext(contextProjectDir, baseOptions);

    const apiRef = response.resources.find((r) => r.name === "api_reference");
    expect(apiRef).toBeTruthy();
    expect(apiRef!.description).toContain("API reference");
    expect(apiRef!.mimeType).toBe("text/markdown");

    const howtoBuild = response.resources.find((r) => r.name === "howto_build_context");
    expect(howtoBuild).toBeTruthy();
    expect(howtoBuild!.description).toContain("build a context project");
    expect(howtoBuild!.mimeType).toBe("text/markdown");
  },
  DENO_PERMISSIONS,
);

test(
  "Context project - Prompts have correct metadata",
  async () => {
    const response = await prepareContext(contextProjectDir, baseOptions);

    const prompt = response.prompts.find((p) =>
      p.name === "explain_context_architecture"
    );
    expect(prompt).toBeTruthy();
    expect(prompt!.description).toContain("architecture");
  },
  DENO_PERMISSIONS,
);

test(
  "Context project - Tool has correct metadata",
  async () => {
    const response = await prepareContext(contextProjectDir, baseOptions);

    const tool = response.tools.find((t) => t.name === "init_context");
    expect(tool).toBeTruthy();
    expect(tool!.description).toContain("Scaffolds");
    expect(tool!.inputSchema).toBeTruthy();
    expect((tool!.inputSchema as Record<string, unknown>).type).toBe("object");
  },
  DENO_PERMISSIONS,
);

test(
  "Context project - MCPContext loads and reads markdown resources",
  async () => {
    const context = new MCPContext();

    await context.loadContext(contextProjectDir, baseOptions);

    expect(context.tools.length).toBe(1);
    expect(context.resources.length).toBe(2);
    expect(context.prompts.length).toBe(1);
    expect(context.agents.length).toBeGreaterThan(0);

    const apiContent = await context.readResource("api_reference", baseOptions);
    expect(apiContent).toContain("MCPContext");
    expect(apiContent).toContain("createEmptyContext");
    expect(apiContent).toContain("prepareContext");

    const howtoContent = await context.readResource(
      "howto_build_context",
      baseOptions,
    );
    expect(howtoContent).toContain("context.json");
    expect(howtoContent).toContain("toolMeta");
  },
  DENO_PERMISSIONS,
);

test(
  "Context project - MCPContext executes init_context tool and creates structure",
  async () => {
    const tempDir = makeTempDirSync();

    try {
      const context = new MCPContext();

      await context.loadContext(contextProjectDir, baseOptions);

      const execOptions: ITSExecuteOptions = {
        importsCwd: projectRoot,
        projectCwd: projectRoot,
        permissions: {
          allowedReadDirs: [contextProjectDir, projectRoot, tempDir],
          allowedWriteDirs: [tempDir],
          allowNetDomains: [],
          allowedPackages: ["npm:zod"],
          allowedExecutables: [],
          allowedEnvironments: [],
        },
        extraArguments: [],
        timeout: 30000,
        configFilePath: join(contextProjectDir, "deno.json"),
      };

      const result = await context.executeTool(
        "init_context",
        { path: tempDir, name: "test-project", description: "Test", author: "Tester" },
        execOptions,
      );

      const resultObj = result as Record<string, unknown>;
      expect(resultObj.status).toBe("completed");
      expect(resultObj.message).toContain("Context project initialized");

      expect(statSync(join(tempDir, "context.json"))).toBeTruthy();
      expect(statSync(join(tempDir, "deno.json"))).toBeTruthy();
      expect(statSync(join(tempDir, "AGENTS.md"))).toBeTruthy();
      expect(statSync(join(tempDir, "tools", "my-tool.ts"))).toBeTruthy();
      expect(statSync(join(tempDir, "resources", "CONCEPT.md"))).toBeTruthy();
      expect(statSync(join(tempDir, "prompts", "explain-concept.md"))).toBeTruthy();

      const contextJson = JSON.parse(
        readTextFileSync(join(tempDir, "context.json")),
      );
      expect(contextJson.name).toBe("test-project");
      expect(contextJson.description).toBe("Test");
      expect(contextJson.author).toBe("Tester");
    } finally {
      removeSync(tempDir);
    }
  },
  DENO_PERMISSIONS,
);

test(
  "Context project - MCPContext can load via MCPBay standard path (context/ subfolder detection)",
  async () => {
    const context = new MCPContext();

    await context.loadContext(projectRoot, baseOptions);

    expect(context.tools.length).toBe(1);
    expect(context.resources.length).toBe(2);
    expect(context.prompts.length).toBe(1);

    const tool = context.tools.find((t) => t.name === "init_context");
    expect(tool).toBeTruthy();
  },
  DENO_PERMISSIONS,
);

test(
  "Context project - Loading same path twice throws",
  async () => {
    const context = new MCPContext();

    await context.loadContext(contextProjectDir, baseOptions);

    await expect(
      context.loadContext(contextProjectDir, baseOptions),
    ).rejects.toThrow("already loaded");
  },
  DENO_PERMISSIONS,
);
