import { dirname } from "@std/path";
import { generateTempFile } from "./generate-temp-file.util.ts";
import { readFile } from "./read-file.util.ts";
import { createDenoCommand, removeSync } from "./fs.util.ts";

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

  if (invoke) {
    const stringifiedArguments = JSON.stringify(invoke.arguments);
    const fnName = invoke.function;

    code += `
;const _mcpb_result = await ${fnName}(...${stringifiedArguments}); 
if(_mcpb_result !== undefined) {
  console.log(JSON.stringify(_mcpb_result));
}`;
  }

  const codeFilePath = generateTempFile(code);
  const tempDir = dirname(codeFilePath);
  const allowedReadDirs = new Set(permissions.allowedReadDirs);

  allowedReadDirs.add("./");
  allowedReadDirs.add(tempDir);

  const allowedReadDirsJoined = Array.from(allowedReadDirs).join(",");

  args.push(`--allow-read=${allowedReadDirsJoined}`);

  const allowedWriteDirs = new Set(permissions.allowedWriteDirs);

  allowedWriteDirs.add("./");
  allowedWriteDirs.add(tempDir);

  const allowedWriteDirsJoined = Array.from(allowedWriteDirs).join(",");

  args.push(`--allow-write=${allowedWriteDirsJoined}`);

  const allowedNetDomains = new Set(permissions.allowNetDomains);

  if (allowedNetDomains.size) {
    const allowedNetDomainsJoined = Array.from(allowedNetDomains).join(",");

    args.push(`--allow-net=${allowedNetDomainsJoined}`);
  }

  if (permissions.allowedExecutables.length) {
    const allowedExecutablesJoined = Array.from(permissions.allowedExecutables)
      .join(",");

    args.push(`--allow-run=${allowedExecutablesJoined}`);
  }

  const allowedEnvironments = new Set(permissions.allowedEnvironments);

  allowedEnvironments.add("TMPDIR");
  allowedEnvironments.add("TMP");
  allowedEnvironments.add("TEMP");

  const allowedEnvironmentsJoined = Array.from(allowedEnvironments).join(",");

  args.push(`--allow-env=${allowedEnvironmentsJoined}`);
  args.push(...extraArguments);

  if (configFilePath) {
    args.push(`--config=${configFilePath}`);
  }

  if (envFilePath) {
    args.push(`--env=${envFilePath}`);
    args.push(`--allow-env`);
  }

  args.push(codeFilePath);

  const command = createDenoCommand(args, {
    cwd: options.projectCwd,
  });

  const decoder = new TextDecoder();
  const child = command.spawn();

  const timeoutId = setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      // empty
    }
  }, timeout);

  const { success, stderr, stdout } = await child.output();

  clearTimeout(timeoutId);

  if (!success) {
    removeSync(codeFilePath);
    const errorMessage = decoder.decode(stderr);
    throw new Error(`${errorMessage}\nOn file: ${scriptPath}`);
  }

  const outMessage = decoder.decode(stdout).trim();

  return { outMessage, codeFilePath };
}
