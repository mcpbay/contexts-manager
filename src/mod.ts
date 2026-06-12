import * as z from "zod";
import { toSnakeCase } from "./transformers/to-snake-case.transformer.ts";
import type { IPrompt, IResource, ITool } from "@mcpbay/easy-mcp-server/types";
import type { IContextConfig } from "./interfaces/mod.ts";
import {
  executeTypeScriptFile,
  type ITSExecuteOptions,
} from "./utils/ts-execute.util.ts";
import { exists } from "./utils/exists.util.ts";
import { crashIfNot } from "./utils/crash-if-not.util.ts";
import { readJsonFromFile } from "./utils/read-json-from-file.util.ts";
import { getDirectoryContent } from "./utils/get-directory-content.util.ts";
import { extractFilePathData } from "./utils/extract-file-path-data.util.ts";
import { toObject } from "./transformers/to-object.transformer.ts";
import { parseFrontMatter } from "./utils/parse-front-matter.util.ts";
import { envHas } from "./utils/fs.util.ts";
import { readTextFile } from "./utils/read-text-file.util.ts";
import { isUndefined } from "@online/is";

export const MCPBAY_CONTEXTS_MANAGER_CONTEXT_TYPE = "mcpbay-contexts-manager";

const contextConfigJsonSchema = z.object({
  name: z.string().trim().toLowerCase().describe("Context name").catch(
    "Context name",
  ),
  version: z.string().describe("Context version").catch("Context version"),
  description: z.string().trim().describe("Context description").catch(
    "Context description",
  ),
  author: z.string().trim().describe("Context author").catch("Context author"),
  tags: z.array(z.string().trim().toLowerCase()).describe("Context tags"),
  contextType: z.string().describe("The context type").catch("Context type"),
  deno: z.object({
    permissions: z.object({
      allowedReadDirs: z.array(z.string()).optional().catch([]),
      allowedWriteDirs: z.array(z.string()).optional().catch([]),
      allowNetDomains: z.array(z.string()).optional().catch([]),
      allowedPackages: z.array(z.string()).optional().catch([]),
      allowedExecutables: z.array(z.string()).optional().catch([]),
      allowedEnvironments: z.array(z.string()).optional().catch([]),
    }),
    extraArguments: z.array(z.string()).optional().catch([]),
    timeout: z.number().optional().catch(5000),
  }).optional().catch({ permissions: {}, extraArguments: [], timeout: 5000 }),
});

const contextResourceMetaJsonSchema = z.object({
  name: z.string().trim().toLowerCase().describe("Resource name").catch(
    "Resource name",
  ),
  description: z.string().trim().describe("Resource description").catch(
    "Resource description",
  ),
  title: z.string().trim().describe("Resource title").catch("Resource title")
    .optional(),
  mimeType: z.string().trim().describe("Resource mime type").catch(
    "Resource mime type",
  ).optional(),
});

const contextResourceScriptMetaResponseJsonSchema = z.object({
  name: z.string().trim().toLowerCase().describe("Resource name"),
  description: z.string().trim().describe("Resource description"),
  title: z.string().trim().describe("Resource title").optional(),
  mimeType: z.string().trim().describe("Resource mime type"),
});

const contextToolMetaJsonSchema = z.object({
  name: z.string().trim().toLowerCase().transform(toSnakeCase).describe(
    "Tool name",
  ),
  description: z.string().trim().describe("Tool description"),
  inputSchema: z.object({}).passthrough().describe("Tool input json schema"),
  title: z.string().trim().describe("Tool title").optional(),
  outputSchema: z.object({}).passthrough().describe(
    "Tool output json schema, used for tool output validation on client-side",
  ).optional(),
});

const contextPromptMetaJsonSchema = z.object({
  name: z.string().trim().toLowerCase().describe("Prompt name"),
  description: z.string().trim().describe("Prompt description"),
  title: z.string().trim().describe("Prompt title").optional(),
});

const contextPromptScriptMetaResponseJsonSchema = z.object({
  name: z.string().trim().toLowerCase().describe("Prompt name"),
  description: z.string().trim().describe("Prompt description"),
  title: z.string().trim().describe("Prompt title").optional(),
});

export interface IPreparedTool extends ITool {
  path: string;
  configFilePath?: string;
}

export interface IPreparedResource extends IResource {
  path: string;
  configFilePath?: string;
}

export interface IPreparedContextResponse {
  resources: IPreparedResource[];
  tools: IPreparedTool[];
  prompts: IPrompt[];
  agents: string;
}

export async function prepareContext(
  path: string,
  options: Omit<ITSExecuteOptions, "permissions">,
): Promise<IPreparedContextResponse> {
  const agentsMdPath = `${path}/AGENTS.md`;
  const contextConfigPath = `${path}/context.json`;
  const denoConfigPath = `${path}/deno.json`;
  const isContextDirPresent = exists(path, true);
  const isContextConfigPresent = exists(contextConfigPath);
  const isAgentsMdPresent = exists(agentsMdPath);

  crashIfNot(isContextDirPresent, `Context dir \`${path}\` does not exist.`);
  crashIfNot(
    isContextConfigPresent,
    `Context config \`${contextConfigPath}\` does not exist.`,
  );

  const agents = isAgentsMdPresent
    ? readTextFile(agentsMdPath)
    : "";

  const contextConfig = readJsonFromFile<IContextConfig>(contextConfigPath);
  const { contextType } = contextConfig;

  crashIfNot(
    isUndefined(contextType) || contextType === MCPBAY_CONTEXTS_MANAGER_CONTEXT_TYPE,
    `Context type \`${contextType}\` is not supported.`
  );

  const allowedEnvironments =
    contextConfig.deno?.permissions?.allowedEnvironments ?? [];
  const hasDenoConfig = exists(denoConfigPath);

  for (const env of allowedEnvironments) {
    const isEnvPresent = envHas(env);

    crashIfNot(
      isEnvPresent,
      `Environment variable \`${env}\` is required but not set.`,
    );
  }

  const _options: ITSExecuteOptions = {
    ...options,
    permissions: {
      allowedEnvironments,
      allowedExecutables: contextConfig.deno?.permissions?.allowedExecutables ?? [],
      allowedPackages: contextConfig.deno?.permissions?.allowedPackages ?? [],
      allowedReadDirs: [],
      allowedWriteDirs: [],
      allowNetDomains: contextConfig.deno?.permissions?.allowNetDomains ?? [],
    },
  };

  if (hasDenoConfig) {
    _options.configFilePath = denoConfigPath;
  }

  contextConfigJsonSchema.parse(contextConfig);

  const resourcesPath = `${path}/resources`;
  const resources = await listResources(
    resourcesPath,
    {
      ..._options,
      invoke: {
        function: "resourceMeta",
        arguments: [],
      },
    },
    [],
    hasDenoConfig,
  );

  const toolsPath = `${path}/tools`;
  const tools = await listTools(
    toolsPath,
    {
      ..._options,
      invoke: {
        function: "toolMeta",
        arguments: [],
      },
    },
    [],
    hasDenoConfig,
  );

  const promptsPath = `${path}/prompts`;
  const prompts = await listPrompts(
    promptsPath,
    {
      ..._options,
      invoke: {
        function: "promptMeta",
        arguments: [],
      },
    },
    [],
    hasDenoConfig,
  );

  return {
    resources,
    tools,
    prompts,
    agents
  };
}

async function listTools(
  basePath: string,
  options: ITSExecuteOptions,
  tools: IPreparedTool[] = [],
  hasDenoConfig = false,
) {
  const isBasePathExists = exists(basePath, true);

  if (!isBasePathExists) {
    return tools;
  }

  const files = getDirectoryContent(basePath);

  for (const file of files.files) {
    const filePath = `${basePath}/${file}`;
    const fileInfo = extractFilePathData(filePath);
    const isTypeScriptFile = fileInfo.extension === ".ts";

    if (isTypeScriptFile) {
      crashIfNot(
        hasDenoConfig,
        `Context tool \`${filePath}\` requires a \`deno.json\` file in the context root.`,
      );

      const { outMessage } = await executeTypeScriptFile(filePath, {
        ...options,
        invoke: {
          function: "toolMeta",
          arguments: [],
        },
      });

      const response = toObject<Record<string, unknown>>(outMessage);

      const parsedToolMeta = contextToolMetaJsonSchema.parse(response);

      tools.push({
        name: parsedToolMeta.name,
        title: parsedToolMeta.title,
        description: parsedToolMeta.description,
        inputSchema: parsedToolMeta.inputSchema,
        outputSchema: parsedToolMeta.outputSchema,
        path: filePath,
        configFilePath: options.configFilePath,
      });
    }
  }

  for (const directory of files.folders) {
    const isIgnoredDirectory = directory.startsWith("@");

    if (isIgnoredDirectory) {
      continue;
    }

    await listTools(`${basePath}/${directory}`, options, tools, hasDenoConfig);
  }

  return tools;
}

async function listResources(
  basePath: string,
  options: ITSExecuteOptions,
  resources: IPreparedResource[] = [],
  hasDenoConfig = false,
) {
  const isBasePathExists = exists(basePath, true);

  if (!isBasePathExists) {
    return resources;
  }

  const files = getDirectoryContent(basePath);

  for (const file of files.files) {
    const filePath = `${basePath}/${file}`;
    const fileInfo = extractFilePathData(filePath);
    const isMarkdownFile = fileInfo.extension === ".md";
    const isTypeScriptFile = fileInfo.extension === ".ts";

    if (isMarkdownFile) {
      const parseDFrontMatter = await parseFrontMatter(filePath);
      const { success, data } = contextResourceMetaJsonSchema.safeParse(
        parseDFrontMatter.data,
      );

      crashIfNot(success, "Invalid resource data.");

      resources.push({
        description: data.description,
        name: data.name,
        mimeType: data.mimeType ?? "text/markdown",
        uri: filePath,
        title: data.title,
        path: filePath,
        configFilePath: options.configFilePath,
      });
    } else if (isTypeScriptFile) {
      crashIfNot(
        hasDenoConfig,
        `Context resource \`${filePath}\` requires a \`deno.json\` file in the context root.`,
      );

      const result = await executeTypeScriptFile(filePath, {
        ...options,
        invoke: {
          function: "resourceMeta",
          arguments: [],
        },
      });

      const response = toObject<Record<string, unknown>>(result.outMessage);

      const parsedResourceMeta = contextResourceScriptMetaResponseJsonSchema
        .parse(response);

      resources.push({
        description: parsedResourceMeta.description,
        name: parsedResourceMeta.name,
        mimeType: parsedResourceMeta.mimeType,
        uri: filePath,
        title: parsedResourceMeta.title,
        path: filePath,
        configFilePath: options.configFilePath,
      });
    }
  }

  for (const folder of files.folders) {
    await listResources(
      `${basePath}/${folder}`,
      options,
      resources,
      hasDenoConfig,
    );
  }

  return resources;
}

async function listPrompts(
  basePath: string,
  options: ITSExecuteOptions,
  prompts: IPrompt[] = [],
  hasDenoConfig = false,
) {
  const isBasePathExists = exists(basePath, true);

  if (!isBasePathExists) {
    return prompts;
  }

  const files = getDirectoryContent(basePath);

  for (const file of files.files) {
    const filePath = `${basePath}/${file}`;
    const fileInfo = extractFilePathData(filePath);
    const isMarkdownFile = fileInfo.extension === ".md";
    const isTypeScriptFile = fileInfo.extension === ".ts";

    if (isMarkdownFile) {
      const parsedFrontMatter = await parseFrontMatter(filePath);
      const { success, data } = contextPromptMetaJsonSchema.safeParse(
        parsedFrontMatter.data,
      );

      crashIfNot(success, "Invalid prompt data.");

      prompts.push({
        name: data.name,
        description: data.description,
        title: data.title,
      });
    } else if (isTypeScriptFile) {
      crashIfNot(
        hasDenoConfig,
        `Context prompt \`${filePath}\` requires a \`deno.json\` file in the context root.`,
      );

      const { outMessage } = await executeTypeScriptFile(filePath, {
        ...options,
        invoke: {
          function: "promptMeta",
          arguments: [],
        },
      });

      const response = toObject<Record<string, unknown>>(outMessage);
      const parsedPromptMeta = contextPromptScriptMetaResponseJsonSchema
        .parse(response);

      prompts.push({
        name: parsedPromptMeta.name,
        description: parsedPromptMeta.description,
        title: parsedPromptMeta.title,
      });
    }
  }

  for (const folder of files.folders) {
    await listPrompts(
      `${basePath}/${folder}`,
      options,
      prompts,
      hasDenoConfig,
    );
  }

  return prompts;
}
