import { expect, test } from "@libs/testing";
import { join } from "@std/path";
import { loadMCP } from "../clients/ai.ts";
import type { ITSExecuteOptions } from "../src/utils/ts-execute.util.ts";
import { generateText } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { cwd, makeTempDirSync, mkdirSync, removeSync, writeTextFileSync } from "../src/utils/fs.util.ts";
import { DENO_PERMISSIONS } from "./constants.ts";

const projectRoot = cwd();

test("loadMCP - Integration with AI SDK generateText", async () => {
  const tempDir = makeTempDirSync();
  const contextDir = join(tempDir, "ai-context");
  const projectCwd = join(tempDir, "project-cwd");

  mkdirSync(contextDir);
  mkdirSync(projectCwd);

  try {
    const contextConfig = {
      name: "ai-test",
      version: "1.0.0",
      description: "AI Test Context",
      author: "Tester",
      tags: ["ai"],
    };

    writeTextFileSync(
      join(contextDir, "context.json"),
      JSON.stringify(contextConfig),
    );
    writeTextFileSync(
      join(contextDir, "deno.json"),
      JSON.stringify({ imports: {} }),
    );

    const toolsDir = join(contextDir, "tools");

    mkdirSync(toolsDir);
    writeTextFileSync(
      join(toolsDir, "test-tool.ts"),
      `
      export function toolMeta() {
        return {
          name: "test_tool",
          description: "A test tool",
          inputSchema: { 
            type: "object", 
            properties: { 
              val: { type: "string" } 
            },
            required: ["val"]
          }
        };
      }
      export function toolHandler(_args: { val: string }) {
        return { result: "Echo: " + (_args?.val || 'undefined') };
      }
    `,
    );

    const resourcesDir = join(contextDir, "resources");

    mkdirSync(resourcesDir);
    writeTextFileSync(
      join(resourcesDir, "test-res.md"),
      `---
name: test_resource
description: A test resource
---
Resource content here`,
    );

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

    const { tools, readResource } = await loadMCP(contextDir, options);

    expect(typeof tools.test_tool).toBe("object");
    expect(tools.test_tool.description).toBe("A test tool");

    const toolResult = await tools.test_tool.execute({ val: "hello" });

    expect(toolResult).toEqual({ result: "Echo: hello" });

    const resourceContent = await readResource("test_resource");
    const isResourceContentPresent = resourceContent.includes("Resource content here");

    expect(isResourceContentPresent).toBe(true);

    let step = 0;
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        step++;
        const isFirstStep = step === 1;

        if (isFirstStep) {
          return {
            content: [
              {
                type: "tool-call",
                toolCallId: "call-1",
                toolName: "test_tool",
                args: { val: "world" },
                input: JSON.stringify({ val: "world" }),
              },
            ],
            finishReason: { unified: "tool-calls", raw: "stop" },
            usage: {
              inputTokens: {
                total: 10,
                noCache: 10,
                cacheRead: 0,
                cacheWrite: 0,
              },
              outputTokens: { total: 10, text: 10, reasoning: 10 },
            },
            warnings: [],
          };
        }

        return {
          content: [{ type: "text", text: "Finished." }],
          finishReason: { unified: "stop", raw: "stop" },
          usage: {
            inputTokens: {
              total: 10,
              noCache: 10,
              cacheRead: 0,
              cacheWrite: 0,
            },
            outputTokens: { total: 10, text: 10, reasoning: 10 },
          },
          warnings: [],
        };
      },
    });

    const result = await generateText({
      model,
      tools,
      system: `Base system. Resource: ${await readResource("test_resource")}`,
      prompt: "Execute the test tool with 'world'",
      maxRetries: 1,
    });

    expect(result.steps.length > 0).toBe(true);
  } finally {
    try {
      removeSync(tempDir);
    } catch {
      // empty
    }
  }
}, DENO_PERMISSIONS);
