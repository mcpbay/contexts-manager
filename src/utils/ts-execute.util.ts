import { dirname } from "@std/path";
import { generateTempFile } from "./generate-temp-file.util.ts";
import { readFile } from "./read-file.util.ts";

/**
 * Options for executing a TypeScript file using Deno.
 */
export interface ITSExecuteOptions {
  /**
   * The working directory URL or path for resolving imports.
   */
  importsCwd: URL | string;
  /**
   * The working directory URL or path for the project.
   */
  projectCwd: URL | string;
  /**
   * Execution permissions for the Deno subprocess.
   */
  permissions: {
    /**
     * Directories allowed for read operations.
     */
    allowedReadDirs: string[];
    /**
     * Directories allowed for write operations.
     */
    allowedWriteDirs: string[];
    /**
     * Network domains allowed for access.
     */
    allowNetDomains: string[];
    /**
     * Allowed external packages.
     */
    allowedPackages: string[];
    /**
     * Allowed executables.
     */
    allowedExecutables: string[];
    /**
     * Allowed environment variables.
     */
    allowedEnvironments: string[];
  };
  /**
   * Additional command-line arguments for Deno.
   */
  extraArguments: string[];
  /**
   * Timeout for the execution in milliseconds.
   */
  timeout: number;
  /**
   * Optional path to a Deno configuration file (deno.json).
   */
  configFilePath?: string;
  /**
   * Optional path to an environment variable file.
   */
  envFilePath?: string;
  /**
   * Optional function to invoke in the script.
   */
  invoke?: {
    /**
     * Name of the function to call.
     */
    function: string;
    /**
     * Arguments to pass to the function.
     */
    arguments: unknown[];
  };
}

/**
 * Executes a TypeScript file in a controlled Deno environment.
 * 
 * @param scriptPath - The path to the TypeScript script.
 * @param options - Execution options.
 * @returns An object containing the output message and the temporary file path used.
 */
export async function executeTypeScriptFile(
  scriptPath: string,
  options: ITSExecuteOptions,
) {
  const {
    permissions,
    timeout,
    invoke,
    extraArguments,
    configFilePath,
    envFilePath,
  } = options;
  const args: string[] = ["run"];
  let code = await readFile(scriptPath);

  // code = removeStaticImports(code);

  if (invoke) {
    const stringifiedArguments = JSON.stringify(invoke.arguments);
    const fnName = invoke.function;
    code += `
;const _mcpb_result = await ${fnName}(...${stringifiedArguments}); 

// if (typeof _mcpb_result !== "object") {
//   throw new Error("Invalid function result, object expected.");
// }

if(_mcpb_result !== undefined) {
  console.log(JSON.stringify(_mcpb_result));
}`;
  }

  const codeFilePath = generateTempFile(code);
  const tempDir = dirname(codeFilePath);
  const allowedReadDirs = new Set(permissions.allowedReadDirs);

  allowedReadDirs.add("./");
  allowedReadDirs.add(tempDir);

  const _allowedReadDirs = Array.from(allowedReadDirs).join(",");
  args.push(`--allow-read=${_allowedReadDirs}`);

  const allowedWriteDirs = new Set(permissions.allowedWriteDirs);

  allowedWriteDirs.add("./");
  allowedWriteDirs.add(tempDir);

  const _allowedWriteDirs = Array.from(allowedWriteDirs).join(",");
  args.push(`--allow-write=${_allowedWriteDirs}`);

  const allowedNetDomains = new Set(permissions.allowNetDomains);

  if (allowedNetDomains.size) {
    const _allowedNetDomains = Array.from(allowedNetDomains).join(",");
    args.push(`--allow-net=${_allowedNetDomains}`);
  }

  const allowedExecutables = new Set(permissions.allowedExecutables);

  if (permissions.allowedExecutables.length) {
    const _allowedExecutables = Array.from(allowedExecutables).join(",");
    args.push(`--allow-run=${_allowedExecutables}`);
  }

  const allowedEnvironments = new Set(permissions.allowedEnvironments);

  allowedEnvironments.add("TMPDIR");
  allowedEnvironments.add("TMP");
  allowedEnvironments.add("TEMP");

  const _allowedEnvironments = Array.from(allowedEnvironments).join(",");
  args.push(`--allow-env=${_allowedEnvironments}`);

  args.push(...extraArguments);

  if (configFilePath) {
    args.push(`--config=${configFilePath}`);
  }

  if (envFilePath) {
    args.push(`--env=${envFilePath}`);
    args.push(`--allow-env`);
  }

  args.push(codeFilePath);

  const command = new Deno.Command("deno", {
    args,
    cwd: options.projectCwd,
    // signal: AbortSignal.timeout(timeout),
    stdin: "null",
    stderr: "piped",
    stdout: "piped",
  });

  const decoder = new TextDecoder();
  const child = command.spawn();
  const timeoutId = setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      // nop
    }
  }, timeout);

  const { success, stderr, stdout } = await child.output();

  clearTimeout(timeoutId);

  if (!success) {
    Deno.removeSync(codeFilePath);
    const errorMessage = decoder.decode(stderr);
    throw new Error(errorMessage);
  }

  const outMessage = decoder.decode(stdout).trim();

  return { outMessage, codeFilePath };
}
