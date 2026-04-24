import { assertEquals, assertExists } from "@std/assert";
import { join } from "@std/path";
import type { ITSExecuteOptions } from "../src/utils/ts-execute.util.ts";
import { prepareContext } from "../src/mod.ts";

const projectRoot = "E:\\Git\\profit\\node\\mcpbay\\mcpbay-mcpb-core";

Deno.test("prepareContext - Exhaustive Config: Optional typeScript fields", async () => {
  Deno.env.set("TEST_VAR", "value");
  const tempDir = Deno.makeTempDirSync();
  try {
    const contextConfig = {
      name: "full-context",
      version: "1.2.3",
      description: "A full context",
      author: "Exhaustive Tester",
      tags: ["test", "exhaustive"],
      typeScript: {
        allowedPackages: ["jsr:@std/assert"],
        allowedExecutables: ["deno"],
        allowedNetDomains: ["example.com"],
        allowedEnvironments: ["TEST_VAR"],
        allowRead: true,
        allowWrite: false,
        extraArguments: ["--allow-all"],
      },
    };
    Deno.writeTextFileSync(
      join(tempDir, "context.json"),
      JSON.stringify(contextConfig),
    );
    Deno.writeTextFileSync(join(tempDir, "deno.json"), JSON.stringify({}));

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

    const response = await prepareContext(tempDir, options);
    assertExists(response);
    assertEquals(response.resources.length, 0);
    assertEquals(response.tools.length, 0);
  } finally {
    Deno.env.delete("TEST_VAR");
    Deno.removeSync(tempDir, { recursive: true });
  }
});

Deno.test("prepareContext - Exhaustive Config: Invalid fields with defaults (.catch)", async () => {
  const tempDir = Deno.makeTempDirSync();
  try {
    const contextConfig = {
      // name is missing, but has .catch("Context name")
      // version is missing, but has .catch("Context version")
      description: 123, // wrong type, but description has .catch()
      author: true, // wrong type, but author has .catch()
      tags: ["valid"],
    };
    Deno.writeTextFileSync(
      join(tempDir, "context.json"),
      JSON.stringify(contextConfig),
    );

    const options: ITSExecuteOptions = {
      importsCwd: projectRoot,
      projectCwd: projectRoot,
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

    const response = await prepareContext(tempDir, options);
    // Since everything except tags has .catch(), it should succeed with defaults
    assertExists(response);
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});

Deno.test("prepareContext - Exhaustive Resource: Markdown with complex metadata", async () => {
  const tempDir = Deno.makeTempDirSync();
  const resourcesDir = join(tempDir, "resources");
  try {
    Deno.mkdirSync(resourcesDir);
    const contextConfig = {
      name: "res-test",
      version: "1",
      description: "d",
      author: "a",
      tags: [],
    };
    Deno.writeTextFileSync(
      join(tempDir, "context.json"),
      JSON.stringify(contextConfig),
    );

    const mdContent = `---
name: complex-resource
description: A very complex description that should be parsed correctly even with weird characters like @#$%^&*()
title: Complex Title
mimeType: application/json
extraField: this should be ignored by the schema but not crash the parser
---
# Content`;
    Deno.writeTextFileSync(join(resourcesDir, "complex.md"), mdContent);

    const options: ITSExecuteOptions = {
      importsCwd: projectRoot,
      projectCwd: projectRoot,
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

    const response = await prepareContext(tempDir, options);
    const res = response.resources.find((r) => r.name === "complex-resource");
    assertExists(res);
    assertEquals(res.mimeType, "application/json");
    assertEquals(res.title, "Complex Title");
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});

Deno.test("prepareContext - Exhaustive Tool: inputSchema and outputSchema validation", async () => {
  const tempDir = Deno.makeTempDirSync();
  const toolsDir = join(tempDir, "tools");
  try {
    Deno.mkdirSync(toolsDir);
    const contextConfig = {
      name: "tool-test",
      version: "1",
      description: "d",
      author: "a",
      tags: [],
    };
    Deno.writeTextFileSync(
      join(tempDir, "context.json"),
      JSON.stringify(contextConfig),
    );
    Deno.writeTextFileSync(join(tempDir, "deno.json"), JSON.stringify({}));

    const tsToolContent = `
      export function toolMeta() {
        return {
          name: "complex_tool",
          description: "A tool with schemas",
          inputSchema: {
            type: "object",
            properties: {
              foo: { type: "string" },
              bar: { type: "number" }
            },
            required: ["foo"]
          },
          outputSchema: {
            type: "object",
            properties: {
              result: { type: "boolean" }
            }
          }
        };
      }
    `;
    Deno.writeTextFileSync(join(toolsDir, "complex.ts"), tsToolContent);

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

    const response = await prepareContext(tempDir, options);
    const tool = response.tools.find((t) => t.name === "complex_tool");
    assertExists(tool);
    assertExists(tool.inputSchema);
    assertExists(tool.outputSchema);
    assertEquals((tool.inputSchema as any).required, ["foo"]);
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});

Deno.test("prepareContext - Exhaustive Tool: Name transformation to snake_case", async () => {
  const tempDir = Deno.makeTempDirSync();
  const toolsDir = join(tempDir, "tools");
  try {
    Deno.mkdirSync(toolsDir);
    const contextConfig = {
      name: "tool-test",
      version: "1",
      description: "d",
      author: "a",
      tags: [],
    };
    Deno.writeTextFileSync(
      join(tempDir, "context.json"),
      JSON.stringify(contextConfig),
    );
    Deno.writeTextFileSync(join(tempDir, "deno.json"), JSON.stringify({}));

    const tsToolContent = `
      export function toolMeta() {
        return {
          name: "My Awesome Tool",
          description: "Testing transformation",
          inputSchema: { type: "object", properties: {} }
        };
      }
    `;
    Deno.writeTextFileSync(join(toolsDir, "transform.ts"), tsToolContent);

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

    const response = await prepareContext(tempDir, options);
    const tool = response.tools.find((t) => t.name === "my_awesome_tool");
    assertExists(tool);
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});
