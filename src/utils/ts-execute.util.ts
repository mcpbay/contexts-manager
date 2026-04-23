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

export async function executeTypeScriptFile(scriptPath: string, options: ITSExecuteOptions) {
  const { permissions, timeout, invoke, extraArguments, configFilePath, envFilePath, importsCwd } = options;
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
    } catch { }
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

// export async function tsExecute(code: string, options: ITSExecuteOptions) {
//   const { permissions, timeout, invoke } = options;
//   const args: string[] = ["run"];

//   code = removeStaticImports(code);
//   code = code.replaceAll("import(", "_mcpb_import(");

//   const mcpbImport = `
// const allowedPackages: string[] = ${JSON.stringify(options.permissions.allowedPackages)
//     };

// function _mcpb_import(_packageName: string) {
//   if (!allowedPackages.includes(_packageName)) {
//     throw new Error(\`Invalid package import: "\${_packageName}".\`);
//   }

//   return import(_packageName);
// }
//   `.trim();

//   code = `${mcpbImport}\n\n${code}`;

//   if (invoke) {
//     code += `
// const _mcpb_result = await ${invoke.function}(...${JSON.stringify(invoke.arguments)
//       });

// //if (typeof _mcpb_result !== "object") {
// //  throw new Error("Invalid function result, object expected.");
// //}

// if(_mcpb_result !== undefined) {
//   console.log(JSON.stringify(_mcpb_result));
// }`;
//   }

//   const codeFilePath = generateTempFile(code);
//   const tempDir = dirname(codeFilePath);

//   if (permissions.allowRead) {
//     args.push(`--allow-read=./,${tempDir}`);
//   }

//   if (permissions.allowWrite) {
//     args.push(`--allow-write=./,${tempDir}`);
//   }

//   if (permissions.allowNet.length) {
//     args.push(`--allow-net=${permissions.allowNet.join(",")}`);
//   }

//   if (permissions.allowedExecutables.length) {
//     args.push(`--allow-run=${permissions.allowedExecutables.join(",")}`);
//   }

//   args.push(`--allow-env=TMPDIR,TMP,TEMP`);
//   args.push(`--unstable-kv`);
//   args.push(codeFilePath);

//   const command = new Deno.Command("deno", {
//     args,
//     cwd: options.cwd,
//     // signal: AbortSignal.timeout(timeout),
//     stdin: "null",
//     stderr: "piped",
//     stdout: "piped",
//   });

//   const decoder = new TextDecoder();
//   const child = command.spawn();

//   const timeoutId = setTimeout(() => {
//     try {
//       child.kill("SIGKILL");
//     } catch { }
//   }, timeout);

//   const { success, stderr, stdout } = await child.output();

//   clearTimeout(timeoutId);

//   if (!success) {
//     Deno.removeSync(codeFilePath);
//     const errorMessage = decoder.decode(stderr);
//     throw new Error(errorMessage);
//   }

//   const outMessage = decoder.decode(stdout).trim();

//   return { outMessage, codeFilePath };
// }

function removeStaticImports(code: string) {
  const len = code.length;
  let i = 0;
  let result = "";

  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < len) {
    const c = code[i];
    const next = code[i + 1];

    // line comment
    if (
      !inSingle && !inDouble && !inTemplate && !inBlockComment && c === "/" &&
      next === "/"
    ) {
      inLineComment = true;
    }

    if (inLineComment && c === "\n") {
      inLineComment = false;
    }

    // block comment
    if (
      !inSingle && !inDouble && !inTemplate && !inLineComment && c === "/" &&
      next === "*"
    ) {
      inBlockComment = true;
    }

    if (inBlockComment && c === "*" && next === "/") {
      inBlockComment = false;
      result += "*/";
      i += 2;
      continue;
    }

    if (inLineComment || inBlockComment) {
      result += c;
      i++;
      continue;
    }

    // strings
    if (!inDouble && !inTemplate && c === "'" && code[i - 1] !== "\\") {
      inSingle = !inSingle;
    } else if (!inSingle && !inTemplate && c === '"' && code[i - 1] !== "\\") {
      inDouble = !inDouble;
    } else if (!inSingle && !inDouble && c === "`" && code[i - 1] !== "\\") {
      inTemplate = !inTemplate;
    }

    if (!inSingle && !inDouble && !inTemplate) {
      // detect static import
      if (code.startsWith("import", i)) {
        const after = code[i + 6];

        // skip dynamic import()
        if (after === "(") {
          result += "import";
          i += 6;
          continue;
        }

        // skip until semicolon or newline
        let j = i;
        while (j < len && code[j] !== ";" && code[j] !== "\n") {
          j++;
        }

        if (code[j] === ";") j++;

        i = j;
        continue;
      }
    }

    result += c;
    i++;
  }

  return result;
}
