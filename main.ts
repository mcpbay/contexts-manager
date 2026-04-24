import type { IPrompt } from "@mcpbay/easy-mcp-server/types";
import { parseFrontMatter } from "./src/utils/parse-front-matter.util.ts";
import { crashIfNot } from "./src/utils/crash-if-not.util.ts";
import {
  executeTypeScriptFile,
  type ITSExecuteOptions,
} from "./src/utils/ts-execute.util.ts";
import * as z from "zod";
import { toObject } from "./src/transformers/to-object.transformer.ts";
import { isScriptResource } from "./src/validators/is-script-resource.validator.ts";
import {
  type IPreparedResource,
  type IPreparedTool,
  prepareContext,
} from "./src/mod.ts";
import { build } from "./src/utils/build.util.ts";
import { exists } from "./src/utils/exists.util.ts";

/**
 * Manages multiple MCP (Model Context Protocol) contexts.
 * Allows loading contexts, executing tools, and reading resources.
 */
export class MCPContext {
  /**
   * List of prepared tools available in the context.
   */
  public readonly tools: IPreparedTool[] = [];
  /**
   * List of prepared resources available in the context.
   */
  public readonly resources: IPreparedResource[] = [];
  /**
   * List of prompts available in the context.
   */
  public readonly prompts: IPrompt[] = [];
  readonly #loadedPaths = new Set<string>();

  /**
   * Loads an MCP context from a given path.
   * 
   * @param path - The absolute path to the context directory.
   * @param options - Execution options for the context.
   * @throws Will throw an error if the context at the given path is already loaded.
   */
  async loadContext(path: string, options: ITSExecuteOptions) {
    crashIfNot(
      !this.#loadedPaths.has(path),
      `Context \`${path}\` already loaded.`,
    );

    const { prompts, resources, tools } = await prepareContext(path, options);

    this.prompts.push(...prompts);
    this.resources.push(...resources);
    this.tools.push(...tools);
    this.#loadedPaths.add(path);
  }

  /**
   * Executes a tool by name with the provided arguments.
   * 
   * @param name - The name of the tool to execute.
   * @param args - The arguments for the tool.
   * @param options - Execution options.
   * @returns The result of the tool execution.
   * @throws Will throw an error if the tool is not found.
   */
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

  /**
   * Reads a resource by name.
   * 
   * @param name - The name of the resource to read.
   * @param options - Execution options.
   * @returns The content of the resource.
   * @throws Will throw an error if the resource is not found or returns an invalid value.
   */
  async readResource(
    name: string,
    options: ITSExecuteOptions,
  ): Promise<string> {
    const resource = this.resources.find((resource) => resource.name === name);

    crashIfNot(resource, `Resource \`${name}\` not found.`);

    const filePath = resource.path;

    if (isScriptResource(filePath)) {
      const { outMessage } = await executeTypeScriptFile(filePath, {
        ...options,
        configFilePath: resource.configFilePath ?? options.configFilePath,
        invoke: {
          function: "resourceHandler",
          arguments: [],
        },
      });

      const resourceResponse = toObject(outMessage);

      crashIfNot(
        resourceResponse,
        `Resource \`${name}\` did not return a value.`,
      );
      crashIfNot(
        typeof resourceResponse === "string",
        `Resource \`${name}\` did not return a string.`,
      );

      return resourceResponse.trim();
    }

    const parseDFrontMatter = await parseFrontMatter(filePath);

    return parseDFrontMatter.content.trim();
  }
}

/**
 * Creates a new, empty MCPBay context structure at the specified path.
 * 
 * @param path - The directory where the new context should be created.
 */
export function createEmptyContext(path: string) {
  if (!exists(path, true)) {
    Deno.mkdirSync(path);
  }

  const DEFAULT_DENO_JSON_CONTENT = {
    tasks: {},
    imports: {
      "@std/assert": "jsr:@std/assert@1",
      "zod": "npm:zod@^4.3.6",
    },
  };

  const DEFAULT_CONTEXT_JSON_CONTENT = {
    name: "",
    version: "1.0.0",
    description: "A useful context for MCPBay!",
    author: "godperson1",
    tags: [],
    typeScript: {
      allowedPackages: ["jsr:@std/assert", "npm:zod"],
      allowedExecutables: [],
      allowedDomains: [],
      allowedEnvs: [],
      allowRead: [],
      allowWrite: [],
      extraArguments: [],
    },
  };

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
      files: [],
    },
  ]);
}

/**
 * Arguments for loading and executing a tool.
 */
export interface ILoadAndExecuteToolArguments {
  /**
   * Absolute path to the MCP context directory.
   */
  contextPath: string;
  /**
   * Name of the tool to execute.
   */
  toolName: string;
  /**
   * Arguments for the tool.
   */
  args: Record<string, unknown>;
  /**
   * Execution options.
   */
  options: ITSExecuteOptions;
}

/**
 * Loads a context and executes a tool in a single operation.
 * 
 * @param args - The arguments for loading and execution.
 * @returns The result of the tool execution.
 */
export async function loadAndExecuteTool(
  args: ILoadAndExecuteToolArguments,
): Promise<object | null> {
  const { contextPath, toolName, args: toolArgs, options } = args;
  const context = new MCPContext();

  await context.loadContext(contextPath, options);

  const result = await context.executeTool(toolName, toolArgs, options);

  console.log(result);

  return result;
}

/**
 * Arguments for loading and reading a resource.
 */
export interface ILoadAndReadResourceArguments {
  /**
   * Absolute path to the MCP context directory.
   */
  contextPath: string;
  /**
   * Name of the resource to read.
   */
  resourceName: string;
  /**
   * Execution options.
   */
  options: ITSExecuteOptions;
}

/**
 * Loads a context and reads a resource in a single operation.
 * 
 * @param args - The arguments for loading and reading.
 * @returns The content of the resource.
 */
export async function loadAndReadResource(
  args: ILoadAndReadResourceArguments,
): Promise<string> {
  const { contextPath, resourceName, options } = args;
  const context = new MCPContext();

  await context.loadContext(contextPath, options);

  const result = await context.readResource(resourceName, options);

  console.log(result);

  return result;
}
