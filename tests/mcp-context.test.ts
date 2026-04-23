import type { ITSExecuteOptions } from "../src/utils/ts-execute.util.ts";
import { assertEquals } from "@std/assert";
import { MCPContext } from "../main.ts";
import { dirname, fromFileUrl, join } from "@std/path";

const __dirname = dirname(fromFileUrl(import.meta.url));
const projectRoot = join(__dirname, "..");

Deno.test("MCPContext - Load multiple contexts and verify tool execution behavior", async () => {
  const tempDir = Deno.makeTempDirSync();
  const projectCwd = join(tempDir, "project-cwd");
  Deno.mkdirSync(projectCwd);

  const context1Dir = join(tempDir, "context1");
  const context2Dir = join(tempDir, "context2");
  Deno.mkdirSync(context1Dir);
  Deno.mkdirSync(context2Dir);

  try {
    // Set up Context 1
    const context1Config = {
      name: "context1",
      version: "1.0.0",
      description: "Context 1",
      author: "Author 1",
      tags: ["test1"],
    };
    Deno.writeTextFileSync(
      join(context1Dir, "context.json"),
      JSON.stringify(context1Config),
    );
    Deno.writeTextFileSync(
      join(context1Dir, "deno.json"),
      JSON.stringify({
        imports: { "helper": "./helper.ts" },
      }),
    );
    Deno.writeTextFileSync(
      join(context1Dir, "helper.ts"),
      "export const val = 'from-context1';",
    );

    const tools1Dir = join(context1Dir, "tools");
    Deno.mkdirSync(tools1Dir);
    Deno.writeTextFileSync(
      join(tools1Dir, "tool1.ts"),
      `
      import { val } from "helper";
      export function toolMeta() {
        return {
          name: "tool1",
          description: "Tool 1",
          inputSchema: { type: "object", properties: {} }
        };
      }
      export function toolHandler() {
        return { 
          val,
          cwd: Deno.cwd()
        };
      }
    `,
    );

    // Set up Context 2
    const context2Config = {
      name: "context2",
      version: "1.0.0",
      description: "Context 2",
      author: "Author 2",
      tags: ["test2"],
    };
    Deno.writeTextFileSync(
      join(context2Dir, "context.json"),
      JSON.stringify(context2Config),
    );
    Deno.writeTextFileSync(
      join(context2Dir, "deno.json"),
      JSON.stringify({
        imports: { "helper": "./helper.ts" },
      }),
    );
    Deno.writeTextFileSync(
      join(context2Dir, "helper.ts"),
      "export const val = 'from-context2';",
    );

    const tools2Dir = join(context2Dir, "tools");
    Deno.mkdirSync(tools2Dir);
    Deno.writeTextFileSync(
      join(tools2Dir, "tool2.ts"),
      `
      import { val } from "helper";
      export function toolMeta() {
        return {
          name: "tool2",
          description: "Tool 2",
          inputSchema: { type: "object", properties: {} }
        };
      }
      export function toolHandler() {
        return { 
          val,
          cwd: Deno.cwd()
        };
      }
    `,
    );

    // Resource with script
    const resources2Dir = join(context2Dir, "resources");
    Deno.mkdirSync(resources2Dir);
    Deno.writeTextFileSync(
      join(resources2Dir, "res2.ts"),
      `
      export function resourceMeta() {
        return {
          name: "res2",
          description: "Res 2",
          mimeType: "text/plain"
        };
      }
      export function resourceHandler() {
        return "Res content from " + Deno.cwd();
      }
    `,
    );

    // Markdown Resource in Context 1
    const resources1Dir = join(context1Dir, "resources");
    Deno.mkdirSync(resources1Dir);
    Deno.writeTextFileSync(
      join(resources1Dir, "res1.md"),
      `---
name: res1
description: Res 1
title: Title 1
---
Content 1`,
    );

    // Markdown Resource in Context 2
    Deno.writeTextFileSync(
      join(resources2Dir, "res3.md"),
      `---
name: res3
description: Res 3
title: Title 3
---
Content 3`,
    );

    // Tool 3 in Context 1
    Deno.writeTextFileSync(
      join(tools1Dir, "tool3.ts"),
      `
      export function toolMeta() {
        return {
          name: "tool3",
          description: "Tool 3",
          inputSchema: { type: "object", properties: {
            text: { type: "string" }
          } }
        };
      }
      export function toolHandler(args: { text: string }) {
        return { 
          echo: args.text
        };
      }
    `,
    );

    const mcpContext = new MCPContext();
    const options: ITSExecuteOptions = {
      importsCwd: projectRoot,
      projectCwd: projectCwd,
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

    await mcpContext.loadContext(context1Dir, options);
    await mcpContext.loadContext(context2Dir, options);

    assertEquals(mcpContext.tools.length, 3);
    assertEquals(mcpContext.resources.length, 3);

    // Verify tools
    const t1 = mcpContext.tools.find((t) => t.name === "tool1");
    const t2 = mcpContext.tools.find((t) => t.name === "tool2");
    const t3 = mcpContext.tools.find((t) => t.name === "tool3");
    assertEquals(!!t1, true);
    assertEquals(!!t2, true);
    assertEquals(!!t3, true);

    // Verify resources
    const r1 = mcpContext.resources.find((r) => r.name === "res1");
    const r2 = mcpContext.resources.find((r) => r.name === "res2");
    const r3 = mcpContext.resources.find((r) => r.name === "res3");
    assertEquals(!!r1, true);
    assertEquals(!!r2, true);
    assertEquals(!!r3, true);

    // Execute Tool 1
    const resp1 = await mcpContext.executeTool("tool1", {}, options);
    assertEquals((resp1 as any).val, "from-context1");
    assertEquals((resp1 as any).cwd, projectCwd);

    // Execute Tool 2
    const resp2 = await mcpContext.executeTool("tool2", {}, options);
    assertEquals((resp2 as any).val, "from-context2");
    assertEquals((resp2 as any).cwd, projectCwd);

    // Execute Tool 3 with args
    const resp3 = await mcpContext.executeTool(
      "tool3",
      { text: "hello" },
      options,
    );
    assertEquals((resp3 as any).echo, "hello");

    // Read Resource 1 (Markdown)
    const res1Content = await mcpContext.readResource("res1", options);
    assertEquals(res1Content, "Content 1");

    // Read Resource 2 (Script)
    const res2Content = await mcpContext.readResource("res2", options);
    assertEquals(res2Content, "Res content from " + projectCwd);

    // Read Resource 3 (Markdown)
    const res3Content = await mcpContext.readResource("res3", options);
    assertEquals(res3Content, "Content 3");
  } finally {
    try {
      Deno.removeSync(tempDir, { recursive: true });
    } catch {
      // Nop
    }
  }
});

Deno.test("MCPContext - Crash if TypeScript tool found but deno.json is missing", async () => {
  const tempDir = Deno.makeTempDirSync();
  const contextDir = join(tempDir, "bad-context");
  Deno.mkdirSync(contextDir);

  try {
    const contextConfig = {
      name: "bad-context",
      version: "1.0.0",
      description: "No deno.json here",
      author: "Author",
      tags: [],
    };
    Deno.writeTextFileSync(
      join(contextDir, "context.json"),
      JSON.stringify(contextConfig),
    );

    const toolsDir = join(contextDir, "tools");
    Deno.mkdirSync(toolsDir);
    Deno.writeTextFileSync(
      join(toolsDir, "tool.ts"),
      "export function toolMeta() { return { name: 't', description: 'd', inputSchema: {} }; }",
    );

    const mcpContext = new MCPContext();
    const options: ITSExecuteOptions = {
      importsCwd: Deno.cwd(),
      projectCwd: Deno.cwd(),
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

    const { assertRejects } = await import("@std/assert");
    await assertRejects(
      () => mcpContext.loadContext(contextDir, options),
      Error,
      "requires a `deno.json` file",
    );
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});

Deno.test("MCPContext - Success if no TypeScript tools/resources and deno.json is missing", async () => {
  const tempDir = Deno.makeTempDirSync();
  const contextDir = join(tempDir, "md-only-context");
  Deno.mkdirSync(contextDir);

  try {
    const contextConfig = {
      name: "md-only-context",
      version: "1.0.0",
      description: "Markdown only",
      author: "Author",
      tags: [],
    };
    Deno.writeTextFileSync(
      join(contextDir, "context.json"),
      JSON.stringify(contextConfig),
    );

    const resourcesDir = join(contextDir, "resources");
    Deno.mkdirSync(resourcesDir);
    Deno.writeTextFileSync(
      join(resourcesDir, "res.md"),
      "---\\nname: res\\ndescription: d\\n---\\nMarkdown content",
    );

    const mcpContext = new MCPContext();
    const options: ITSExecuteOptions = {
      importsCwd: Deno.cwd(),
      projectCwd: Deno.cwd(),
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

    await mcpContext.loadContext(contextDir, options);
    assertEquals(mcpContext.resources.length, 1);
    assertEquals(mcpContext.tools.length, 0);
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});
