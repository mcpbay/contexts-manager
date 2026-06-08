import type { ITSExecuteOptions } from "../src/utils/ts-execute.util.ts";
import { expect, test } from "@libs/testing";
import { MCPContext } from "../main.ts";
import { join } from "@std/path";
import {
  cwd,
  makeTempDirSync,
  mkdirSync,
  removeSync,
  writeTextFileSync,
} from "../src/utils/fs.util.ts";
import { DENO_PERMISSIONS } from "./constants.ts";

const projectRoot = cwd();

test(
  "MCPContext - Load multiple contexts and verify tool execution behavior",
  async () => {
    const tempDir = makeTempDirSync();
    const projectCwdDir = join(tempDir, "project-cwd");

    mkdirSync(projectCwdDir);

    const context1Dir = join(tempDir, "context1");
    const context2Dir = join(tempDir, "context2");

    mkdirSync(context1Dir);
    mkdirSync(context2Dir);

    try {
      const context1Config = {
        name: "context1",
        version: "1.0.0",
        description: "Context 1",
        author: "Author 1",
        tags: ["test1"],
      };

      writeTextFileSync(
        join(context1Dir, "context.json"),
        JSON.stringify(context1Config),
      );
      writeTextFileSync(
        join(context1Dir, "deno.json"),
        JSON.stringify({
          imports: { "helper": "./helper.ts" },
        }),
      );
      writeTextFileSync(
        join(context1Dir, "helper.ts"),
        "export const val = 'from-context1';",
      );

      const tools1Dir = join(context1Dir, "tools");

      mkdirSync(tools1Dir);
      writeTextFileSync(
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

      const context2Config = {
        name: "context2",
        version: "1.0.0",
        description: "Context 2",
        author: "Author 2",
        tags: ["test2"],
      };

      writeTextFileSync(
        join(context2Dir, "context.json"),
        JSON.stringify(context2Config),
      );
      writeTextFileSync(
        join(context2Dir, "deno.json"),
        JSON.stringify({
          imports: { "helper": "./helper.ts" },
        }),
      );
      writeTextFileSync(
        join(context2Dir, "helper.ts"),
        "export const val = 'from-context2';",
      );

      const tools2Dir = join(context2Dir, "tools");

      mkdirSync(tools2Dir);
      writeTextFileSync(
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

      const resources2Dir = join(context2Dir, "resources");

      mkdirSync(resources2Dir);
      writeTextFileSync(
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

      const resources1Dir = join(context1Dir, "resources");

      mkdirSync(resources1Dir);
      writeTextFileSync(
        join(resources1Dir, "res1.md"),
        `---
name: res1
description: Res 1
title: Title 1
---
Content 1`,
      );

      writeTextFileSync(
        join(resources2Dir, "res3.md"),
        `---
name: res3
description: Res 3
title: Title 3
---
Content 3`,
      );

      writeTextFileSync(
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
        projectCwd: projectCwdDir,
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

      await mcpContext.loadContext(context1Dir, { tsExecutionOptions: options });
      await mcpContext.loadContext(context2Dir, { tsExecutionOptions: options });

      expect(mcpContext.tools.length).toBe(3);
      expect(mcpContext.resources.length).toBe(3);

      const t1 = mcpContext.tools.find((t) => t.name === "tool1");
      const t2 = mcpContext.tools.find((t) => t.name === "tool2");
      const t3 = mcpContext.tools.find((t) => t.name === "tool3");

      expect(t1).toBeTruthy();
      expect(t2).toBeTruthy();
      expect(t3).toBeTruthy();

      const r1 = mcpContext.resources.find((r) => r.name === "res1");
      const r2 = mcpContext.resources.find((r) => r.name === "res2");
      const r3 = mcpContext.resources.find((r) => r.name === "res3");

      expect(r1).toBeTruthy();
      expect(r2).toBeTruthy();
      expect(r3).toBeTruthy();

      const resp1 = await mcpContext.executeTool("tool1", {}, options);

      // deno-lint-ignore no-explicit-any
      expect((resp1 as any).val).toBe("from-context1");
      // deno-lint-ignore no-explicit-any
      expect((resp1 as any).cwd).toBe(projectCwdDir);

      const resp2 = await mcpContext.executeTool("tool2", {}, options);

      // deno-lint-ignore no-explicit-any
      expect((resp2 as any).val).toBe("from-context2");
      // deno-lint-ignore no-explicit-any
      expect((resp2 as any).cwd).toBe(projectCwdDir);

      const resp3 = await mcpContext.executeTool(
        "tool3",
        { text: "hello" },
        options,
      );

      // deno-lint-ignore no-explicit-any
      expect((resp3 as any).echo).toBe("hello");

      const res1Content = await mcpContext.readResource("res1", options);

      expect(res1Content).toBe("Content 1");

      const res2Content = await mcpContext.readResource("res2", options);

      expect(res2Content).toBe("Res content from " + projectCwdDir);

      const res3Content = await mcpContext.readResource("res3", options);

      expect(res3Content).toBe("Content 3");
    } finally {
      try {
        removeSync(tempDir);
      } catch {
        // empty
      }
    }
  },
  DENO_PERMISSIONS,
);

test(
  "MCPContext - Crash if TypeScript tool found but deno.json is missing",
  async () => {
    const tempDir = makeTempDirSync();
    const contextDir = join(tempDir, "bad-context");

    mkdirSync(contextDir);

    try {
      const contextConfig = {
        name: "bad-context",
        version: "1.0.0",
        description: "No deno.json here",
        author: "Author",
        tags: [],
      };

      writeTextFileSync(
        join(contextDir, "context.json"),
        JSON.stringify(contextConfig),
      );

      const toolsDir = join(contextDir, "tools");

      mkdirSync(toolsDir);
      writeTextFileSync(
        join(toolsDir, "tool.ts"),
        "export function toolMeta() { return { name: 't', description: 'd', inputSchema: {} }; }",
      );

      const mcpContext = new MCPContext();
      const options: ITSExecuteOptions = {
        importsCwd: cwd(),
        projectCwd: cwd(),
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

      await expect(mcpContext.loadContext(contextDir, { tsExecutionOptions: options })).rejects.toThrow(
        "requires a `deno.json` file",
      );
    } finally {
      removeSync(tempDir);
    }
  },
  DENO_PERMISSIONS,
);

test(
  "MCPContext - Success if no TypeScript tools/resources and deno.json is missing",
  async () => {
    const tempDir = makeTempDirSync();
    const contextDir = join(tempDir, "md-only-context");

    mkdirSync(contextDir);

    try {
      const contextConfig = {
        name: "md-only-context",
        version: "1.0.0",
        description: "Markdown only",
        author: "Author",
        tags: [],
      };

      writeTextFileSync(
        join(contextDir, "context.json"),
        JSON.stringify(contextConfig),
      );

      const resourcesDir = join(contextDir, "resources");

      mkdirSync(resourcesDir);
      writeTextFileSync(
        join(resourcesDir, "res.md"),
        "---\\nname: res\\ndescription: d\\n---\\nMarkdown content",
      );

      const mcpContext = new MCPContext();
      const options: ITSExecuteOptions = {
        importsCwd: cwd(),
        projectCwd: cwd(),
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

      await mcpContext.loadContext(contextDir, { tsExecutionOptions: options });

      expect(mcpContext.resources.length).toBe(1);
      expect(mcpContext.tools.length).toBe(0);
    } finally {
      removeSync(tempDir);
    }
  },
  DENO_PERMISSIONS,
);
