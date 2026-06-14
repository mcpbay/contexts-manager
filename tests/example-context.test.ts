import { expect, test } from "@libs/testing";
import { join } from "@std/path";
import { MCPContext } from "../main.ts";
import { prepareContext } from "../src/mod.ts";
import type { ITSExecuteOptions } from "../src/utils/deno-run.util.ts";
import { cwd } from "../src/utils/fs.util.ts";
import { DENO_PERMISSIONS } from "./constants.ts";

const projectRoot = cwd();
const exampleContextDir = join(
  projectRoot,
  "tests",
  "contexts",
  "example-context",
);

const baseOptions: ITSExecuteOptions = {
  importsCwd: projectRoot,
  projectCwd: projectRoot,
  permissions: {
    allowedReadDirs: [exampleContextDir, projectRoot],
    allowedWriteDirs: [],
    allowNetDomains: [],
    allowedPackages: ["jsr:@std/assert", "npm:zod"],
    allowedExecutables: [],
    allowedEnvironments: [],
  },
  extraArguments: [],
  timeout: 30000,
  configFilePath: join(projectRoot, "deno.json"),
};

test(
  "Example context - prepareContext loads all tools, resources, and prompts",
  async () => {
    const response = await prepareContext(exampleContextDir, baseOptions);

    expect(response.tools.length).toBe(1);
    expect(response.resources.length).toBe(2);
    expect(response.prompts.length).toBe(2);

    const tool = response.tools.find((t) => t.name === "greeting_tool");
    expect(tool).toBeTruthy();
    expect(tool!.description).toBe("Give me a greeting");

    const greetPrompt = response.prompts.find((p) => p.name === "greet_user");
    expect(greetPrompt).toBeTruthy();
    expect(greetPrompt!.description).toBe(
      "Generates a welcome message for a given user",
    );

    const reportPrompt = response.prompts.find((p) =>
      p.name === "generate_report"
    );
    expect(reportPrompt).toBeTruthy();
    expect(reportPrompt!.description).toBe(
      "Generates a report in the specified format",
    );
  },
  DENO_PERMISSIONS,
);

test(
  "Example context - MCPContext loads and executes the greeting tool",
  async () => {
    const context = new MCPContext();

    await context.loadContext(exampleContextDir, baseOptions);

    expect(context.tools.length).toBe(1);
    expect(context.resources.length).toBe(2);
    expect(context.prompts.length).toBe(2);

    const result = await context.executeTool(
      "greeting_tool",
      { name: "TestUser" },
      baseOptions,
    );

    expect(result).toBeTruthy();
    expect((result as Record<string, unknown>).greeting).toBe(
      "Hello, TestUser! Welcome to the example MCPBay context.",
    );
  },
  DENO_PERMISSIONS,
);

test(
  "Example context - MCPContext reads the markdown resource",
  async () => {
    const context = new MCPContext();

    await context.loadContext(exampleContextDir, baseOptions);

    const content = await context.readResource("readme", baseOptions);

    expect(content).toContain("markdown resource for the example");
  },
  DENO_PERMISSIONS,
);
