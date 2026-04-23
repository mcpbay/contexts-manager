import { assertEquals } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";
import { loadMCP } from "../clients/ai.ts";
import type { ITSExecuteOptions } from "../src/utils/ts-execute.util.ts";
import { generateText } from "ai";
import { MockLanguageModelV3 } from "ai/test";

const __dirname = dirname(fromFileUrl(import.meta.url));
const projectRoot = join(__dirname, "..");

Deno.test("loadMCP - Integration with AI SDK generateText", async () => {
  const tempDir = Deno.makeTempDirSync();
  const contextDir = join(tempDir, "ai-context");
  const projectCwd = join(tempDir, "project-cwd");
  Deno.mkdirSync(contextDir);
  Deno.mkdirSync(projectCwd);

  try {
    // Setup Context
    const contextConfig = {
      name: "ai-test",
      version: "1.0.0",
      description: "AI Test Context",
      author: "Tester",
      tags: ["ai"],
    };
    Deno.writeTextFileSync(
      join(contextDir, "context.json"),
      JSON.stringify(contextConfig),
    );
    Deno.writeTextFileSync(
      join(contextDir, "deno.json"),
      JSON.stringify({ imports: {} }),
    );

    // Add a Tool
    const toolsDir = join(contextDir, "tools");
    Deno.mkdirSync(toolsDir);
    Deno.writeTextFileSync(
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
      export function toolHandler(args: { val: string }) {
        return { result: "Echo: " + (args?.val || 'undefined') };
      }
    `,
    );

    // Add a Resource
    const resourcesDir = join(contextDir, "resources");
    Deno.mkdirSync(resourcesDir);
    Deno.writeTextFileSync(
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

    // Load MCP
    const { tools, system } = await loadMCP(contextDir, options);

    // 1. Verify Tools conversion
    assertEquals(typeof tools.test_tool, "object");
    assertEquals(tools.test_tool.description, "A test tool");

    // 2. Verify Manual Execution (Direct AI SDK Tool execution)
    const toolResult = await tools.test_tool.execute({ val: "hello" });
    assertEquals(toolResult, { result: "Echo: hello" });

    // 3. Verify System Prompt (Resources integration)
    assertEquals(system.includes("### MCP Resources"), true);
    assertEquals(system.includes("test_resource"), true);
    assertEquals(system.includes("Resource content here"), true);

    // 4. Mock generateText Integration
    let step = 0;
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        step++;
        if (step === 1) {
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
            usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 10 } },
            warnings: [],
          };
        }

        return {
          content: [{ type: "text", text: "Finished." }],
          finishReason: { unified: "stop", raw: "stop" },
          usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 10 } },
          warnings: [],
        };
      },
    });

    const result = await generateText({
      model,
      tools,
      system: `Base system. ${system}`,
      prompt: "Execute the test tool with 'world'",
      maxRetries: 1,
    });

    // Check that generateText completed
    assertEquals(result.steps.length > 0, true);

  } finally {
    try {
      Deno.removeSync(tempDir, { recursive: true });
    } catch {
      // Nop
    }
  }
});
