import { assertEquals } from "@std/assert";
import {
  executeTypeScriptFile,
  type ITSExecuteOptions,
} from "../src/utils/ts-execute.util.ts";
import { join } from "@std/path";

const projectRoot = "E:\\Git\\profit\\node\\mcpbay\\mcpbay-mcpb-core";

Deno.test("executeTypeScriptFile - response robustness (object)", async () => {
  const scriptContent = `
    export function testFn(arg: any) {
      return { received: arg, status: "ok" };
    }
  `;
  const scriptPath = Deno.makeTempFileSync({ suffix: ".ts" });
  await Deno.writeTextFile(scriptPath, scriptContent);

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
    timeout: 10000,
    configFilePath: join(projectRoot, "deno.json"),
    invoke: {
      function: "testFn",
      arguments: ["hello world"],
    },
  };

  try {
    const result = await executeTypeScriptFile(scriptPath, options);
    const parsed = JSON.parse(result.outMessage);
    assertEquals(parsed, { received: "hello world", status: "ok" });
  } finally {
    try {
      await Deno.remove(scriptPath);
    } catch {
      // nop
    }
  }
});

Deno.test("executeTypeScriptFile - response robustness (primitive types)", async () => {
  const scriptContent = `
    export function returnString() { return "hello"; }
    export function returnNumber() { return 123; }
    export function returnBoolean() { return true; }
    export function returnNull() { return null; }
  `;
  const scriptPath = Deno.makeTempFileSync({ suffix: ".ts" });
  await Deno.writeTextFile(scriptPath, scriptContent);

  const baseOptions: ITSExecuteOptions = {
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
    timeout: 10000,
    configFilePath: join(projectRoot, "deno.json"),
  };

  try {
    // String
    const resString = await executeTypeScriptFile(scriptPath, {
      ...baseOptions,
      invoke: { function: "returnString", arguments: [] },
    });
    assertEquals(resString.outMessage, '"hello"');

    // Number
    const resNumber = await executeTypeScriptFile(scriptPath, {
      ...baseOptions,
      invoke: { function: "returnNumber", arguments: [] },
    });
    assertEquals(resNumber.outMessage, "123");

    // Boolean
    const resBoolean = await executeTypeScriptFile(scriptPath, {
      ...baseOptions,
      invoke: { function: "returnBoolean", arguments: [] },
    });
    assertEquals(resBoolean.outMessage, "true");

    // Null
    const resNull = await executeTypeScriptFile(scriptPath, {
      ...baseOptions,
      invoke: { function: "returnNull", arguments: [] },
    });
    assertEquals(resNull.outMessage, "null");
  } finally {
    try {
      await Deno.remove(scriptPath);
    } catch {
      // nop
    }
  }
});

Deno.test("executeTypeScriptFile - deno.json configuration (import map)", async () => {
  // Create a temporary deno.json with an import map
  // Note: Deno requires absolute paths or valid URLs in import maps if they are not relative to the config file.
  // We'll use a data URL for simplicity in the import map.
  const configContent = JSON.stringify({
    "imports": {
      "dummy-pkg":
        "data:text/javascript,export const value = 'from-import-map';",
    },
  });
  const configPath = Deno.makeTempFileSync({ suffix: ".json" });
  await Deno.writeTextFile(configPath, configContent);

  const scriptContent = `
    import { value } from "dummy-pkg";
    export function check() {
      return value;
    }
  `;
  const scriptPath = Deno.makeTempFileSync({ suffix: ".ts" });
  await Deno.writeTextFile(scriptPath, scriptContent);

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
    timeout: 20000,
    configFilePath: configPath,
    invoke: {
      function: "check",
      arguments: [],
    },
  };

  try {
    const result = await executeTypeScriptFile(scriptPath, options);
    assertEquals(result.outMessage, '"from-import-map"');
  } finally {
    try {
      await Deno.remove(scriptPath);
    } catch {
      // nop
    }
    try {
      await Deno.remove(configPath);
    } catch {
      // nop
    }
  }
});

Deno.test("executeTypeScriptFile - without config and env paths", async () => {
  const scriptContent = `
    export function hello() {
      return "world";
    }
  `;
  const scriptPath = Deno.makeTempFileSync({ suffix: ".ts" });
  await Deno.writeTextFile(scriptPath, scriptContent);

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
    timeout: 10000,
    invoke: {
      function: "hello",
      arguments: [],
    },
  };

  try {
    const result = await executeTypeScriptFile(scriptPath, options);
    assertEquals(result.outMessage, '"world"');
  } finally {
    try {
      await Deno.remove(scriptPath);
    } catch {
      // nop
    }
  }
});
