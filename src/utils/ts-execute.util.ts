import { dirname } from "@std/path";
import { generateTempFile } from "./generate-temp-file.util.ts";
import { readFile } from "./read-file.util.ts";

export interface ITSExecuteOptions {
  importsCwd: URL | string;
  projectCwd: URL | string;
  permissions: {
    allowedReadDirs: string[];
    allowedWriteDirs: string[];
    allowNetDomains: string[];
    allowedPackages: string[];
    allowedExecutables: string[];
    allowedEnvironments: string[];
  };
  extraArguments: string[];
  timeout: number;
  configFilePath?: string;
  envFilePath?: string;
  invoke?: {
    function: string;
    arguments: unknown[];
  };
}

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
