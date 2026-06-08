import { expect, test } from "@libs/testing";
import {
  executeTypeScriptFile,
  type ITSExecuteOptions,
} from "../src/utils/ts-execute.util.ts";
import { join } from "@std/path";
import { makeTempFileSync, removeSync, writeTextFileSync } from "../src/utils/fs.util.ts";
import { DENO_PERMISSIONS } from "./constants.ts";

const projectRoot = "E:\\Git\\profit\\node\\mcpbay\\mcpbay-mcpb-core";

test("executeTypeScriptFile - response robustness (object)", async () => {
  const scriptContent = `
    export function testFn(arg: any) {
      return { received: arg, status: "ok" };
    }
  `;
  const scriptPath = makeTempFileSync("ts");

  writeTextFileSync(scriptPath, scriptContent);

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
      function: "testFn",
      arguments: ["hello world"],
    },
  };

  try {
    const result = await executeTypeScriptFile(scriptPath, options);
    const parsed = JSON.parse(result.outMessage);

    expect(parsed).toEqual({ received: "hello world", status: "ok" });
  } finally {
    try {
      await removeSync(scriptPath);
    } catch {
      // empty
    }
  }
}, DENO_PERMISSIONS);

test("executeTypeScriptFile - response robustness (primitive types)", async () => {
  const scriptContent = `
    export function returnString() { return "hello"; }
    export function returnNumber() { return 123; }
    export function returnBoolean() { return true; }
    export function returnNull() { return null; }
  `;
  const scriptPath = makeTempFileSync("ts");

  writeTextFileSync(scriptPath, scriptContent);

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
  };

  try {
    const resString = await executeTypeScriptFile(scriptPath, {
      ...baseOptions,
      invoke: { function: "returnString", arguments: [] },
    });

    expect(resString.outMessage).toBe('"hello"');

    const resNumber = await executeTypeScriptFile(scriptPath, {
      ...baseOptions,
      invoke: { function: "returnNumber", arguments: [] },
    });

    expect(resNumber.outMessage).toBe("123");

    const resBoolean = await executeTypeScriptFile(scriptPath, {
      ...baseOptions,
      invoke: { function: "returnBoolean", arguments: [] },
    });

    expect(resBoolean.outMessage).toBe("true");

    const resNull = await executeTypeScriptFile(scriptPath, {
      ...baseOptions,
      invoke: { function: "returnNull", arguments: [] },
    });

    expect(resNull.outMessage).toBe("null");
  } finally {
    try {
      removeSync(scriptPath);
    } catch {
      // empty
    }
  }
}, DENO_PERMISSIONS);

test("executeTypeScriptFile - deno.json configuration (import map)", async () => {
  const configContent = JSON.stringify({
    "imports": {
      "dummy-pkg":
        "data:text/javascript,export const value = 'from-import-map';",
    },
  });
  const configPath = makeTempFileSync("json");

  await writeTextFileSync(configPath, configContent);

  const scriptContent = `
    import { value } from "dummy-pkg";
    export function check() {
      return value;
    }
  `;
  const scriptPath = makeTempFileSync("ts");

  writeTextFileSync(scriptPath, scriptContent);

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

    expect(result.outMessage).toBe('"from-import-map"');
  } finally {
    try {
      removeSync(scriptPath);
    } catch {
      // empty
    }
    try {
      removeSync(configPath);
    } catch {
      // empty
    }
  }
}, DENO_PERMISSIONS);

test("executeTypeScriptFile - without config and env paths", async () => {
  const scriptContent = `
    export function hello() {
      return "world";
    }
  `;
  const scriptPath = makeTempFileSync("ts");

  await writeTextFileSync(scriptPath, scriptContent);

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

    expect(result.outMessage).toBe('"world"');
  } finally {
    try {
      await removeSync(scriptPath);
    } catch {
      // empty
    }
  }
}, DENO_PERMISSIONS);
