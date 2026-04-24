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
  typeScript: z.object({
    allowedPackages: z.array(z.string()).optional().catch([]),
    allowedExecutables: z.array(z.string()).optional().catch([]),
    allowNetDomains: z.array(z.string()).optional().catch([]),
    allowedEnvironments: z.array(z.string()).optional().catch([]),
    allowRead: z.boolean().optional().catch(false),
    allowWrite: z.boolean().optional().catch(false),
    extraArguments: z.array(z.string()).optional().catch([]),
  }).optional(),
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
}

export async function prepareContext(
  path: string,
  options: Omit<ITSExecuteOptions, "permissions">,
): Promise<IPreparedContextResponse> {
  const contextConfigPath = `${path}/context.json`;
  const denoConfigPath = `${path}/deno.json`;

  crashIfNot(exists(path, true), `Context dir \`${path}\` does not exist.`);
  crashIfNot(
    exists(contextConfigPath),
    `Context config \`${contextConfigPath}\` does not exist.`,
  );

  const contextConfig = readJsonFromFile<IContextConfig>(contextConfigPath);
  const _options: ITSExecuteOptions = {
    ...options,
    permissions: {
      allowedEnvironments: contextConfig.typeScript?.allowedEnvironments ?? [],
      allowedExecutables: contextConfig.typeScript?.allowedExecutables ?? [],
      allowedPackages: contextConfig.typeScript?.allowedPackages ?? [],
      allowedReadDirs: [],
      allowedWriteDirs: [],
      allowNetDomains: contextConfig.typeScript?.allowNetDomains ?? [],
    },
  };

  const hasDenoConfig = exists(denoConfigPath);

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

  return {
    resources,
    tools,
    prompts: [],
  };
}

async function listTools(
  basePath: string,
  options: ITSExecuteOptions,
  tools: IPreparedTool[] = [],
  hasDenoConfig = false,
) {
  if (!exists(basePath, true)) {
    return tools;
  }

  const files = getDirectoryContent(basePath);

  for (const file of files.files) {
    const filePath = `${basePath}/${file}`;
    const fileInfo = extractFilePathData(filePath);

    if (fileInfo.extension === ".ts") {
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
    if (directory.startsWith("@")) {
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
  if (!exists(basePath, true)) {
    return resources;
  }

  const files = getDirectoryContent(basePath);

  for (const file of files.files) {
    const filePath = `${basePath}/${file}`;
    const fileInfo = extractFilePathData(filePath);

    if (fileInfo.extension === ".md") {
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
    } else if (fileInfo.extension === ".ts") {
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
