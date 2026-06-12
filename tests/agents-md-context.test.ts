import { expect, test } from "@libs/testing";
import { join } from "@std/path";
import { MCPContext } from "../main.ts";
import { prepareContext } from "../src/mod.ts";
import type { ITSExecuteOptions } from "../src/utils/ts-execute.util.ts";
import {
  cwd,
  makeTempDirSync,
  mkdirSync,
  removeSync,
  writeTextFileSync,
} from "../src/utils/fs.util.ts";
import { DENO_PERMISSIONS } from "./constants.ts";

const projectRoot = cwd();

function createMinimalContext(
  dir: string,
  agentsMdContent?: string,
) {
  mkdirSync(dir);
  mkdirSync(`${dir}/resources`);
  mkdirSync(`${dir}/prompts`);
  mkdirSync(`${dir}/tools`);

  writeTextFileSync(
    join(dir, "context.json"),
    JSON.stringify({
      name: "agents-test-context",
      version: "1.0.0",
      description: "Test context for AGENTS.md",
      author: "test",
      tags: [],
    }),
  );

  if (agentsMdContent !== undefined) {
    writeTextFileSync(join(dir, "AGENTS.md"), agentsMdContent);
  }
}

const baseOptions: ITSExecuteOptions = {
  importsCwd: projectRoot,
  projectCwd: projectRoot,
  permissions: {
    allowedReadDirs: [projectRoot],
    allowedWriteDirs: [],
    allowNetDomains: [],
    allowedPackages: [],
    allowedExecutables: [],
    allowedEnvironments: [],
  },
  extraArguments: [],
  timeout: 10000,
  configFilePath: join(projectRoot, "deno.json"),
};

test(
  "AGENTS.md - prepareContext loads AGENTS.md when present",
  async () => {
    const tempDir = makeTempDirSync();
    const contextDir = join(tempDir, "with-agents");

    try {
      createMinimalContext(
        contextDir,
        "# My Agent\n\nThis agent should do X and Y.",
      );

      const response = await prepareContext(contextDir, baseOptions);

      expect(response.agents).toBe("# My Agent\n\nThis agent should do X and Y.");
    } finally {
      removeSync(tempDir);
    }
  },
  DENO_PERMISSIONS,
);

test(
  "AGENTS.md - prepareContext returns empty string when AGENTS.md is missing",
  async () => {
    const tempDir = makeTempDirSync();
    const contextDir = join(tempDir, "without-agents");

    try {
      createMinimalContext(contextDir);

      const response = await prepareContext(contextDir, baseOptions);

      expect(response.agents).toBe("");
    } finally {
      removeSync(tempDir);
    }
  },
  DENO_PERMISSIONS,
);

test(
  "AGENTS.md - MCPContext.loadContext loads AGENTS.md via full flow",
  async () => {
    const tempDir = makeTempDirSync();
    const contextDir = join(tempDir, "mcp-with-agents");

    try {
      const agentsContent =
        "You are a helpful assistant that always responds in Spanish.";
      createMinimalContext(contextDir, agentsContent);

      const context = new MCPContext();

      await context.loadContext(contextDir, baseOptions);

      expect(context.agents).toBe(agentsContent);
    } finally {
      removeSync(tempDir);
    }
  },
  DENO_PERMISSIONS,
);

test(
  "AGENTS.md - MCPContext.loadContext returns empty string when AGENTS.md is missing",
  async () => {
    const tempDir = makeTempDirSync();
    const contextDir = join(tempDir, "mcp-without-agents");

    try {
      createMinimalContext(contextDir);

      const context = new MCPContext();

      await context.loadContext(contextDir, baseOptions);

      expect(context.agents).toBe("");
    } finally {
      removeSync(tempDir);
    }
  },
  DENO_PERMISSIONS,
);

test(
  "AGENTS.md - MCPContext default agents property is empty string",
  () => {
    const context = new MCPContext();

    expect(context.agents).toBe("");
  },
);
