import { expect, test } from "@libs/testing";
import { join } from "@std/path";
import type { ITSExecuteOptions } from "../src/utils/ts-execute.util.ts";
import { prepareContext } from "../src/mod.ts";
import { cwd, makeTempDirSync, mkdirSync, removeSync, writeTextFileSync } from "../src/utils/fs.util.ts";

const projectRoot = cwd();

test("prepareContext - Success: Load resources and tools correctly", async () => {
  const tempDir = makeTempDirSync();
  const resourcesDir = join(tempDir, "resources");
  const toolsDir = join(tempDir, "tools");

  try {
    mkdirSync(resourcesDir);
    mkdirSync(toolsDir);

    const contextConfig = {
      name: "test-context",
      version: "1.0.0",
      description: "A test context",
      author: "Test Author",
      tags: ["test"],
    };

    writeTextFileSync(
      join(tempDir, "context.json"),
      JSON.stringify(contextConfig),
    );
    writeTextFileSync(
      join(tempDir, "deno.json"),
      JSON.stringify({}),
    );
    const mdResourceContent = `---
name: test-md-resource
description: A test markdown resource
title: Test MD Resource
---
# Content`;

    writeTextFileSync(join(resourcesDir, "test.md"), mdResourceContent);

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
    writeTextFileSync(join(resourcesDir, "test.ts"), tsResourceContent);

    const tsToolContent = `
      export function toolMeta() {
        return {
          name: "test-tool",
          description: "A test tool",
          inputSchema: { type: "object", properties: {} }
        };
      }
    `;
    writeTextFileSync(join(toolsDir, "test-tool.ts"), tsToolContent);

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

    expect(response.resources.length).toBe(2);
    expect(response.tools.length).toBe(1);

    const mdResource = response.resources.find((r) =>
      r.name === "test-md-resource"
    );

    expect(mdResource?.title).toBe("Test MD Resource");

    const tsResource = response.resources.find((r) =>
      r.name === "test-ts-resource"
    );

    expect(tsResource?.mimeType).toBe("text/plain");

    const tool = response.tools.find((t) => t.name === "test_tool");

    expect(tool?.description).toBe("A test tool");
  } finally {
    try {
      removeSync(tempDir);
    } catch {
      // empty
    }
  }
});

test("prepareContext - Failure: Context directory does not exist", async () => {
  const nonExistentDir = join(cwd(), "non-existent-context-dir");
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

  await expect(prepareContext(nonExistentDir, options)).rejects.toThrow("Context dir");
});

test("prepareContext - Failure: context.json does not exist", async () => {
  const tempDir = makeTempDirSync();
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
    await expect(prepareContext(tempDir, options)).rejects.toThrow("Context config");
  } finally {
    removeSync(tempDir);
  }
});

test("prepareContext - Success: Load with no resources and tools folders", async () => {
  const tempDir = makeTempDirSync();

  try {
    const contextConfig = {
      name: "no-folders-context",
      version: "1.0.0",
      description: "A context without resources or tools folders",
      author: "Test Author",
      tags: [],
    };

    writeTextFileSync(
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

    expect(response.resources.length).toBe(0);
    expect(response.tools.length).toBe(0);
  } finally {
    removeSync(tempDir);
  }
});

test("prepareContext - Failure: context.json invalid format (missing required fields)", async () => {
  const tempDir = makeTempDirSync();

  try {
    const contextConfig = {
      version: "1.0.0",
    };

    writeTextFileSync(
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

    await expect(prepareContext(tempDir, options)).rejects.toThrow();
  } finally {
    removeSync(tempDir);
  }
});

test("prepareContext - Failure: Tool metadata invalid format", async () => {
  const tempDir = makeTempDirSync();
  const toolsDir = join(tempDir, "tools");

  try {
    mkdirSync(toolsDir);
    const contextConfig = {
      name: "invalid-tool-context",
      version: "1.0.0",
      description: "desc",
      author: "author",
      tags: [],
    };

    writeTextFileSync(
      join(tempDir, "context.json"),
      JSON.stringify(contextConfig),
    );
    writeTextFileSync(
      join(tempDir, "deno.json"),
      JSON.stringify({}),
    );
    const tsToolContent = `
      export function toolMeta() {
        return {
          description: "A test tool"
        };
      }
    `;

    writeTextFileSync(join(toolsDir, "bad-tool.ts"), tsToolContent);

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

    await expect(prepareContext(tempDir, options)).rejects.toThrow();
  } finally {
    removeSync(tempDir);
  }
});

test("prepareContext - Failure: Resource metadata invalid format", async () => {
  const tempDir = makeTempDirSync();
  const resourcesDir = join(tempDir, "resources");

  try {
    mkdirSync(resourcesDir);
    const contextConfig = {
      name: "invalid-resource-context",
      version: "1.0.0",
      description: "desc",
      author: "author",
      tags: [],
    };

    writeTextFileSync(
      join(tempDir, "context.json"),
      JSON.stringify(contextConfig),
    );
    writeTextFileSync(
      join(tempDir, "deno.json"),
      JSON.stringify({}),
    );

    const tsResourceContent = `
      export function resourceMeta() {
        return {
          something: "else"
        };
      }
    `;

    writeTextFileSync(
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

    await expect(prepareContext(tempDir, options)).rejects.toThrow();
  } finally {
    removeSync(tempDir);
  }
});
