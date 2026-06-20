import { dirname } from "@std/path";
import { generateTempFile } from "./generate-temp-file.util.ts";
import { createDenoCommand, removeSync } from "./fs.util.ts";
import { readTextFile } from "./read-text-file.util.ts";
import { resolvePath } from "./resolve-path.util.ts";
import { readJsonFromFile } from "./read-json-from-file.util.ts";
import { randomUUID } from "node:crypto";

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
  tempFile?: boolean;
  configFilePath?: string;
  envFilePath?: string;
  invoke?: {
    function: string;
    arguments: unknown[];
  };
}

export interface IDenoJson {
  imports?: Record<string, string>;
}

function generateTempFolder() {
  const tempDir = Deno.makeTempDirSync({ prefix: `mcpb-temp-${randomUUID()}` });
  return tempDir;
}

function fixPath(path: string) {
  return "file://" + path.replace(/\\/g, "/");
}

export function fixImports(_imports: Record<string, string>, importsCwd: string | URL): Record<string, string> {
  const imports: Record<string, string> = {};

  for (const [key, value] of Object.entries(_imports)) {
    const isPrefixed =
      value.startsWith("jsr:")
      || value.startsWith("file:")
      || value.startsWith("https:")
      || value.startsWith("http:")
      || value.startsWith("data:")
      || value.startsWith("blob:")
      || value.startsWith("npm:");

    imports[key] = isPrefixed ? value : fixPath(resolvePath(value, importsCwd));
  }

  return imports;
}

function getResolvedConfigFileImports(options: ITSExecuteOptions) {
  const { configFilePath, importsCwd } = options;

  if (!configFilePath) {
    return {
      tempFolder: null,
      tempDenoJson: null,
    };
  }

  const tempFolder = generateTempFolder();
  const config = readJsonFromFile<IDenoJson>(configFilePath);

  config.imports = fixImports(config.imports ?? {}, importsCwd);

  const tempDenoJson = generateTempFile(JSON.stringify(config, null, 2), tempFolder, "json");

  return { tempFolder, tempDenoJson };
}

export async function denoRun(
  scriptPath: string,
  options: ITSExecuteOptions,
) {
  const {
    permissions,
    timeout,
    invoke,
    extraArguments,
    envFilePath,
    projectCwd,
    importsCwd
  } = options;
  const resolvedScriptPath = dirname(resolvePath(scriptPath, projectCwd));
  const args: string[] = ["run"];
  let code = readTextFile(scriptPath);

  if (invoke) {
    const stringifiedArguments = JSON.stringify(invoke.arguments);
    const fnName = invoke.function;
    const injectableCode = `
;(async () => {
  const result = await ${fnName}(...${stringifiedArguments}); 
  if(result !== undefined) {
    console.log(JSON.stringify(result));
  }
})();
    `.trim();

    if (!code.includes(injectableCode)) {
      code += "\n" + injectableCode;
    }
  }

  const { tempDenoJson: resolvedConfigFilePath, tempFolder } = getResolvedConfigFileImports(options);
  const codeFilePath = generateTempFile(code, resolvedScriptPath);
  const allowedReadDirs = new Set(permissions.allowedReadDirs);
  const resolvedImportsCwd = resolvePath("./", importsCwd);

  allowedReadDirs.add(resolvedImportsCwd);
  allowedReadDirs.add(resolvedScriptPath);

  const allowedReadDirsJoined = Array.from(allowedReadDirs).join(",");

  args.push(`--allow-read=${allowedReadDirsJoined}`);

  const allowedWriteDirs = new Set(permissions.allowedWriteDirs);

  allowedWriteDirs.add("./");
  allowedWriteDirs.add(resolvedScriptPath);

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


  args.push(...extraArguments);

  if (resolvedConfigFilePath) {
    args.push(`--config=${resolvedConfigFilePath}`);
  }

  if (envFilePath) {
    args.push(`--env=${envFilePath}`);
    args.push(`--allow-env`);
  } else {
    const allowedEnvironmentsJoined = Array.from(allowedEnvironments).join(",");
    args.push(`--allow-env=${allowedEnvironmentsJoined}`);
  }

  args.push(codeFilePath);

  try {
    const command = createDenoCommand(args, {
      cwd: projectCwd,
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
      const errorMessage = decoder.decode(stderr);
      throw new Error(`${errorMessage}\nOn file: ${scriptPath}`);
    }

    const outMessage = decoder.decode(stdout).trim();
    const fullCmd = `deno ${args.map(a => a.replaceAll("\\", "/")).join(" ")}`;

    return { outMessage, fullCmd };
  } finally {
    removeSync(codeFilePath);
    if (tempFolder) {
      removeSync(tempFolder);
    }
  }
}
