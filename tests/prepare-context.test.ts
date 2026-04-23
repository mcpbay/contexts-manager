import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import type { ITSExecuteOptions } from "../src/utils/ts-execute.util.ts";
import { prepareContext } from "../src/mod.ts";

const projectRoot = "E:\\Git\\profit\\node\\mcpbay\\mcpbay-mcpb-core";

Deno.test("prepareContext - Success: Load resources and tools correctly", async () => {
  const tempDir = Deno.makeTempDirSync();
  const resourcesDir = join(tempDir, "resources");
  const toolsDir = join(tempDir, "tools");

  try {
    Deno.mkdirSync(resourcesDir);
    Deno.mkdirSync(toolsDir);

    const contextConfig = {
      name: "test-context",
      version: "1.0.0",
      description: "A test context",
      author: "Test Author",
      tags: ["test"],
    };
    Deno.writeTextFileSync(
      join(tempDir, "context.json"),
      JSON.stringify(contextConfig),
    );

    // Markdown Resource
    const mdResourceContent = `---
name: test-md-resource
description: A test markdown resource
title: Test MD Resource
---
# Content`;
    Deno.writeTextFileSync(join(resourcesDir, "test.md"), mdResourceContent);

    // TypeScript Resource
    const tsResourceContent = `
      export function resourceMeta() {
        return {
          name: "test-ts-resource",
          description: "A test ts resource",
          title: "Test TS Resource",
          mimeType: "text/plain"
        };
      }
    `;
    Deno.writeTextFileSync(join(resourcesDir, "test.ts"), tsResourceContent);

    // TypeScript Tool
    const tsToolContent = `
      export function toolMeta() {
        return {
          name: "test-tool",
          description: "A test tool",
          inputSchema: { type: "object", properties: {} }
        };
      }
    `;
    Deno.writeTextFileSync(join(toolsDir, "test-tool.ts"), tsToolContent);

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
      configFilePath: join(projectRoot, "deno.json"),
    };

    const response = await prepareContext(tempDir, options);

    assertEquals(response.resources.length, 2);
    assertEquals(response.tools.length, 1);

    const mdResource = response.resources.find((r) =>
      r.name === "test-md-resource"
    );
    assertEquals(mdResource?.title, "Test MD Resource");

    const tsResource = response.resources.find((r) =>
      r.name === "test-ts-resource"
    );
    assertEquals(tsResource?.mimeType, "text/plain");

    const tool = response.tools.find((t) => t.name === "test-tool");
    assertEquals(tool?.description, "A test tool");
  } finally {
    try {
      Deno.removeSync(tempDir, { recursive: true });
    } catch {
      // nop
    }
  }
});

Deno.test("prepareContext - Failure: Context directory does not exist", async () => {
  const nonExistentDir = join(Deno.cwd(), "non-existent-context-dir");
  const options: ITSExecuteOptions = {
    importsCwd: projectRoot,
    projectCwd: projectRoot,
    permissions: {
      allowedReadDirs: [],
      allowedWriteDirs: [],
      allowNetDomains: [],
      allowedPackages: [],
      allowedExecutables: [],
      allowedEnvironments: [],
    },
    extraArguments: [],
    timeout: 5000,
  };

  await assertRejects(
    () => prepareContext(nonExistentDir, options),
    Error,
    "Context dir",
  );
});

Deno.test("prepareContext - Failure: context.json does not exist", async () => {
  const tempDir = Deno.makeTempDirSync();
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

  try {
    await assertRejects(
      () => prepareContext(tempDir, options),
      Error,
      "Context config",
    );
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});

Deno.test("prepareContext - Success: Load with no resources and tools folders", async () => {
  const tempDir = Deno.makeTempDirSync();
  try {
    const contextConfig = {
      name: "no-folders-context",
      version: "1.0.0",
      description: "A context without resources or tools folders",
      author: "Test Author",
      tags: [],
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

    assertEquals(response.resources.length, 0);
    assertEquals(response.tools.length, 0);
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});

Deno.test("prepareContext - Failure: context.json invalid format (missing required fields)", async () => {
  const tempDir = Deno.makeTempDirSync();
  try {
    const contextConfig = {
      // name is missing
      version: "1.0.0",
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

    // Since schemas use .catch() for some fields, we check if it fails or returns defaults
    // In this case, name, version, description, author have .catch(), but tags doesn't.
    // If tags is missing, it should throw.
    await assertRejects(() => prepareContext(tempDir, options));
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});

Deno.test("prepareContext - Failure: Tool metadata invalid format", async () => {
  const tempDir = Deno.makeTempDirSync();
  const toolsDir = join(tempDir, "tools");
  try {
    Deno.mkdirSync(toolsDir);
    const contextConfig = {
      name: "invalid-tool-context",
      version: "1.0.0",
      description: "desc",
      author: "author",
      tags: [],
    };
    Deno.writeTextFileSync(
      join(tempDir, "context.json"),
      JSON.stringify(contextConfig),
    );

    const tsToolContent = `
      export function toolMeta() {
        return {
          // name is missing, but schema has .catch()
          // inputSchema is missing, and it's required WITHOUT .catch()
          description: "A test tool"
        };
      }
    `;
    Deno.writeTextFileSync(join(toolsDir, "bad-tool.ts"), tsToolContent);

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
      configFilePath: join(projectRoot, "deno.json"),
    };

    await assertRejects(() => prepareContext(tempDir, options));
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});

Deno.test("prepareContext - Failure: Resource metadata invalid format", async () => {
  const tempDir = Deno.makeTempDirSync();
  const resourcesDir = join(tempDir, "resources");
  try {
    Deno.mkdirSync(resourcesDir);
    const contextConfig = {
      name: "invalid-resource-context",
      version: "1.0.0",
      description: "desc",
      author: "author",
      tags: [],
    };
    Deno.writeTextFileSync(
      join(tempDir, "context.json"),
      JSON.stringify(contextConfig),
    );

    // Markdown Resource with missing fields that don't have .catch()
    // Actually, contextResourceMetaJsonSchema has .catch() for name and description.
    // So it might not throw but use "Resource name" / "Resource description".

    // Let's test TS resource where safety parse is used and crashIfNot
    const tsResourceContent = `
      export function resourceMeta() {
        return {
          // missing required fields for contextResourceScriptMetaResponseJsonSchema
          something: "else"
        };
      }
    `;
    Deno.writeTextFileSync(
      join(resourcesDir, "bad-resource.ts"),
      tsResourceContent,
    );

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
      configFilePath: join(projectRoot, "deno.json"),
    };

    await assertRejects(() => prepareContext(tempDir, options));
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});
