import type { IPrompt } from "@mcpbay/easy-mcp-server/types";
import { parseFrontMatter } from "./src/utils/parse-front-matter.util.ts";
import { crashIfNot } from "./src/utils/crash-if-not.util.ts";
import {
  type ITSExecuteOptions,
  executeTypeScriptFile,
} from "./src/utils/ts-execute.util.ts";
import * as z from "zod";
import { toObject } from "./src/transformers/to-object.transformer.ts";
import { isScriptResource } from "./src/validators/is-script-resource.validator.ts";
import {
  type IPreparedResource,
  type IPreparedTool,
  MCPBAY_CONTEXTS_MANAGER_CONTEXT_TYPE,
  prepareContext,
} from "./src/mod.ts";
import { build } from "./src/utils/build.util.ts";
import { exists } from "./src/utils/exists.util.ts";
import { mkdirSync, removeSync } from "./src/utils/fs.util.ts";
import {
  type IGitHubContextSource,
  downloadGitHubContext,
  isStandardGitUrl,
  parseGitHubURI,
  parseGitUrl,
} from "./src/utils/download-github-context.util.ts";
import type { IContextConfig } from "./src/interfaces/mod.ts";
import { isContextProjectFolder } from "./src/validators/is-context-project-folder.validator.ts";

export interface IGithubOptions {
  allowGithubContext: boolean;
  githubContextDestinyDirPath: string;
  githubToken: string;
}

export interface IMCPContextOptions extends IGithubOptions { }

export type { IContextConfig };
export { isContextProjectFolder };

export class MCPContext {
  public readonly agents: string = ""; // This will be updated later, with `loadContext` method.
  public readonly tools: IPreparedTool[] = [];
  public readonly resources: IPreparedResource[] = [];
  public readonly prompts: IPrompt[] = [];
  readonly #loadedPaths = new Set<string>();
  readonly #tempDirs = new Set<string>();
  readonly #cleanupRegistry: FinalizationRegistry<string>;
  #githubOptions?: Partial<IGithubOptions>;

  constructor(options?: Partial<IMCPContextOptions>) {
    this.#githubOptions = options;
    this.#cleanupRegistry = new FinalizationRegistry((tempDir) => {
      try {
        removeSync(tempDir);
      } catch {
        // ignore cleanup errors
      }
    });
  }

  async loadContext(path: string, options: ITSExecuteOptions) {
    const isAlreadyLoaded = this.#loadedPaths.has(path);

    crashIfNot(
      !isAlreadyLoaded,
      `Context \`${path}\` already loaded.`,
    );

    let loadPath = path;

    if (path.startsWith("github://") || isStandardGitUrl(path)) {
      crashIfNot(this.#githubOptions?.allowGithubContext, "Github context is not allowed.");

      const source = path.startsWith("github://")
        ? parseGitHubURI(path)
        : parseGitUrl(path);

      if (this.#githubOptions?.githubToken) {
        source.token = this.#githubOptions?.githubToken;
      }

      const tempDir = await downloadGitHubContext(
        source,
        this.#githubOptions?.githubContextDestinyDirPath,
      );

      this.#tempDirs.add(tempDir);
      this.#cleanupRegistry.register(this, tempDir);
      loadPath = tempDir;
    }

    if (!isContextProjectFolder(loadPath)) {
      loadPath = `${loadPath}/context`;
    }

    const { prompts, resources, tools, agents } = await prepareContext(
      loadPath,
      options,
    );

    this.#loadedPaths.add(path);
    this.prompts.push(...prompts);
    this.resources.push(...resources);
    this.tools.push(...tools);
    Object.assign(this, { agents });
  }

  dispose() {
    for (const dir of this.#tempDirs) {
      try {
        removeSync(dir);
      } catch {
        // ignore cleanup errors
      }
    }

    this.#tempDirs.clear();
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>,
    options: ITSExecuteOptions,
  ): Promise<object | null> {
    const tool = this.tools.find((tool) => tool.name === name);

    crashIfNot(tool, `Tool \`${name}\` not found.`);

    z.fromJSONSchema(tool.inputSchema as Record<string, unknown>).parse(args);

    const { outMessage } = await executeTypeScriptFile(
      tool.path,
      {
        ...options,
        configFilePath: tool.configFilePath ?? options.configFilePath,
        invoke: {
          function: "toolHandler",
          arguments: args ? [args] : [{}],
        },
      },
    );

    const toolResponse = toObject<object>(outMessage);

    return toolResponse;
  }

  async readResource(
    name: string,
    options: ITSExecuteOptions,
  ): Promise<string> {
    const resource = this.resources.find((resource) => resource.name === name);

    crashIfNot(resource, `Resource \`${name}\` not found.`);

    const filePath = resource.path;
    const isScript = isScriptResource(filePath);

    if (isScript) {
      const { outMessage } = await executeTypeScriptFile(filePath, {
        ...options,
        configFilePath: resource.configFilePath ?? options.configFilePath,
        invoke: {
          function: "resourceHandler",
          arguments: [],
        },
      });

      const resourceResponse = toObject(outMessage);
      const isResourceResponseNull = !resourceResponse;
      const isResourceResponseNotString = typeof resourceResponse !== "string";

      crashIfNot(
        !isResourceResponseNull,
        `Resource \`${name}\` did not return a value.`,
      );
      crashIfNot(
        !isResourceResponseNotString,
        `Resource \`${name}\` did not return a string.`,
      );

      return resourceResponse.trim();
    }

    const parseDFrontMatter = await parseFrontMatter(filePath);

    return parseDFrontMatter.content.trim();
  }
}

export function createEmptyContext(path: string) {
  const isDirectoryExists = exists(path, true);

  if (!isDirectoryExists) {
    mkdirSync(path);
  }

  const DEFAULT_DENO_JSON_CONTENT = {
    tasks: {},
    imports: {
      "@std/assert": "jsr:@std/assert@1",
      "zod": "npm:zod@^4.3.6",
    },
  };

  const DEFAULT_CONTEXT_JSON_CONTENT = {
    name: "test_context",
    version: "1.0.0",
    description: "A useful context for MCPBay!",
    author: "GodPerson_I",
    tags: [],
    deno: {
      permissions: {
        allowedPackages: ["jsr:@std/assert", "npm:zod"],
        allowedExecutables: [],
        allowedEnvironments: [],
        allowedReadDirs: [],
        allowedWriteDirs: [],
        allowNetDomains: [],
      },
      extraArguments: [],
      timeout: 5000,
    },
    contextType: MCPBAY_CONTEXTS_MANAGER_CONTEXT_TYPE,
  } satisfies IContextConfig;

  const DEFAULT_RESOURCE_EXAMPLE_CONTENT = `
---
name: CONCEPT
description: My useful resource
---
# Example

Resource context
  `.trim();

  const DEFAULT_RESOURCE_SCRIPT_EXAMPLE_CONTENT = `
export function resourceMeta() {
  return {
    name: "concept",
    description: "My useful resource",
    title: "Concept",
    mimeType: "text/markdown"
  }
}

export function resourceHandler() {
  return "Resource context";
}
  `.trim();

  const DEFAULT_PROMPT_EXAMPLE_CONTENT = `
---
name: analyze_code
description: Analyzes a given code snippet
---
# Code Analysis Request

Please analyze the following {{language}} code and provide insights about its structure, potential issues, and suggestions for improvement.

\`\`\`{{language}}
{{code}}
\`\`\`
  `.trim();

  const DEFAULT_TOOL_SCRIPT_EXAMPLE_CONTENT = `
import { z } from "zod";

export function toolMeta() {
  return {
    name: "greeting_tool",
    description: "Give me a greeting",
    title: "Greeting Tool",
    inputSchema: z.object({
      name: z.string().describes("Name"),
    }).toJSONSchema(),
  }
}

export function toolHandler(args: Record<string, string>) {
  const { name } = args;

  return {
    greeting: \`Hello, \${name}!\`,
  }
}
  `.trim();

  build(path, [
    {
      type: "file",
      name: "context",
      extension: "json",
      content: DEFAULT_CONTEXT_JSON_CONTENT,
    },
    {
      type: "file",
      name: "deno",
      extension: "json",
      content: DEFAULT_DENO_JSON_CONTENT,
    },
    {
      type: "file",
      name: "AGENTS",
      extension: "md",
      content: "",
    },
    { type: "folder", name: "tools", files: [] },
    {
      type: "folder",
      name: "resources",
      files: [
        {
          type: "file",
          name: "CONCEPT",
          extension: "md",
          content: DEFAULT_RESOURCE_EXAMPLE_CONTENT,
        },
        {
          type: "file",
          name: "CONCEPT",
          extension: "ts",
          content: DEFAULT_RESOURCE_SCRIPT_EXAMPLE_CONTENT,
        },
      ],
    },
    {
      type: "folder",
      name: "tools",
      files: [
        {
          type: "file",
          name: "hello",
          extension: "ts",
          content: DEFAULT_TOOL_SCRIPT_EXAMPLE_CONTENT,
        },
      ],
    },
    {
      type: "folder",
      name: "prompts",
      files: [
        {
          type: "file",
          name: "analyze-code",
          extension: "md",
          content: DEFAULT_PROMPT_EXAMPLE_CONTENT,
        },
      ],
    },
  ]);
}

export interface ILoadAndExecuteToolArguments {
  contextPath: string;
  toolName: string;
  args: Record<string, unknown>;
  options: ITSExecuteOptions;
}

export async function loadAndExecuteTool(
  args: ILoadAndExecuteToolArguments,
): Promise<object | null> {
  const { contextPath, toolName, args: toolArgs, options } = args;
  const context = new MCPContext();

  await context.loadContext(contextPath, options);

  const result = await context.executeTool(toolName, toolArgs, options);

  return result;
}

export interface ILoadAndReadResourceArguments {
  contextPath: string;
  resourceName: string;
  options: ITSExecuteOptions;
}

export async function loadAndReadResource(
  args: ILoadAndReadResourceArguments,
): Promise<string> {
  const { contextPath, resourceName, options } = args;
  const context = new MCPContext();

  await context.loadContext(contextPath, options);

  const result = await context.readResource(resourceName, options);

  return result;
}

export interface ILoadContextFromGitHubArguments {
  source: IGitHubContextSource | string;
  options: ITSExecuteOptions;
  destinyDir?: string;
  token?: string;
}

export async function loadContextFromGitHub(
  args: ILoadContextFromGitHubArguments,
): Promise<MCPContext> {
  const token =
    args.token ?? (typeof args.source !== "string" ? args.source.token : undefined);
  const context = new MCPContext({
    allowGithubContext: true,
    githubContextDestinyDirPath: args.destinyDir,
    githubToken: token,
  });

  const path = typeof args.source === "string"
    ? (isStandardGitUrl(args.source) ? args.source : args.source)
    : `github://${args.source.owner}/${args.source.repo}${args.source.branch && args.source.branch !== "main"
      ? `/tree/${args.source.branch}`
      : ""
    }${args.source.path ? `/${args.source.path}` : ""}`;

  await context.loadContext(path, args.options);

  return context;
}
