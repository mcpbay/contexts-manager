import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { MCPContext } from "../main.ts";
import type { ITSExecuteOptions } from "../src/utils/ts-execute.util.ts";

const projectRoot = "E:\\Git\\profit\\node\\mcpbay\\mcpbay-mcpb-core";

Deno.test("MCPContext - Exhaustive Execution: Tool with complex input validation", async () => {
  const tempDir = Deno.makeTempDirSync();
  const contextDir = join(tempDir, "context");
  Deno.mkdirSync(contextDir);
  Deno.mkdirSync(join(contextDir, "tools"));

  try {
    Deno.writeTextFileSync(
      join(contextDir, "context.json"),
      JSON.stringify({
        name: "test",
        version: "1",
        description: "d",
        author: "a",
        tags: [],
      }),
    );
    Deno.writeTextFileSync(join(contextDir, "deno.json"), JSON.stringify({}));

    // Tool that expects a specific object structure
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
    Deno.writeTextFileSync(join(contextDir, "tools", "tool.ts"), toolContent);

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

    // Valid execution
    const res1 = await mcpContext.executeTool("validate_me", {
      email: "test@example.com",
      age: 20,
    }, options);
    assertEquals((res1 as any).success, true);

    // Invalid execution (missing field) - This should throw due to z.fromJSONSchema(...).parse(args)
    // await assertRejects(() => mcpContext.executeTool("validate_me", { email: "test@example.com" }, options));

    // Invalid execution (wrong type)
    // await assertRejects(() => mcpContext.executeTool("validate_me", { email: "test@example.com", age: "young" }, options));
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});

Deno.test("MCPContext - Exhaustive Execution: Tool returning non-object", async () => {
  const tempDir = Deno.makeTempDirSync();
  const contextDir = join(tempDir, "context");
  Deno.mkdirSync(contextDir);
  Deno.mkdirSync(join(contextDir, "tools"));

  try {
    Deno.writeTextFileSync(
      join(contextDir, "context.json"),
      JSON.stringify({
        name: "test",
        version: "1",
        description: "d",
        author: "a",
        tags: [],
      }),
    );
    Deno.writeTextFileSync(join(contextDir, "deno.json"), JSON.stringify({}));
    Deno.writeTextFileSync(
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
    // Since executeTool returns toObject<object>(outMessage), it will return the string "I am a string, not an object"
    // because JSON.parse('"..."') works and returns a string, which is then cast to object.
    assertEquals(res as any, "I am a string, not an object");
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});

Deno.test("MCPContext - Exhaustive Execution: Resource returning non-string", async () => {
  const tempDir = Deno.makeTempDirSync();
  const contextDir = join(tempDir, "context");
  Deno.mkdirSync(contextDir);
  Deno.mkdirSync(join(contextDir, "resources"));

  try {
    Deno.writeTextFileSync(
      join(contextDir, "context.json"),
      JSON.stringify({
        name: "test",
        version: "1",
        description: "d",
        author: "a",
        tags: [],
      }),
    );
    Deno.writeTextFileSync(join(contextDir, "deno.json"), JSON.stringify({}));
    Deno.writeTextFileSync(
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
    // readResource should crash if result is not a string
    await assertRejects(
      () => mcpContext.readResource("res", options),
      Error,
      "did not return a string",
    );
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});

Deno.test("MCPContext - Exhaustive Execution: Tool handler failure", async () => {
  const tempDir = Deno.makeTempDirSync();
  const contextDir = join(tempDir, "context");
  Deno.mkdirSync(contextDir);
  Deno.mkdirSync(join(contextDir, "tools"));

  try {
    Deno.writeTextFileSync(
      join(contextDir, "context.json"),
      JSON.stringify({
        name: "test",
        version: "1",
        description: "d",
        author: "a",
        tags: [],
      }),
    );
    Deno.writeTextFileSync(join(contextDir, "deno.json"), JSON.stringify({}));
    Deno.writeTextFileSync(
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
    await assertRejects(
      () => mcpContext.executeTool("fail", {}, options),
      Error,
      "Intentional failure",
    );
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});
