import { tool } from "ai";
import * as z from "zod";
import { MCPContext } from "../main.ts";
import type { ITSExecuteOptions } from "../src/utils/ts-execute.util.ts";

/**
 * Options for the MCP AI context loader.
 * Extends standard execution options with filtering capabilities.
 */
export interface IMCPContextAiOptions extends ITSExecuteOptions {
  /**
   * Identifiers to ignore from the loaded context.
   */
  ignore?: {
    /**
     * Tool names to ignore.
     */
    tools?: string[];
    /**
     * Resource names to ignore.
     */
    resources?: string[];
    /**
     * Prompt names to ignore.
     */
    prompts?: string[];
  };
}

/**
 * Response returned by the loadMCP function.
 */
export interface ILoadMCPResponse {
  /**
   * A record of tools compatible with Vercel's AI SDK.
   */
  tools: Record<string, any>;
  /**
   * Function to read the content of a resource.
   * 
   * @param name - The name of the resource.
   * @returns The content of the resource.
   */
  readResource(name: string): Promise<string>;
  /**
   * The underlying MCPContext instance.
   */
  context: MCPContext;
}

/**
 * Loads an MCP context and prepares it for use with Vercel's AI SDK.
 *
 * This function initializes an MCPContext from the given path and converts
 * its tools and resources into a format compatible with `generateText` and other
 * AI SDK functions.
 *
 * @param path The absolute path to the MCP context directory.
 * @param options Execution options and optional ignore filters.
 * @returns An object containing `tools` and a `readResource` function.
 */
export async function loadMCP(
  path: string,
  options: IMCPContextAiOptions,
): Promise<ILoadMCPResponse> {
  const context = new MCPContext();
  const tools: Record<string, any> = {};

  await context.loadContext(path, options);

  for (const t of context.tools) {
    if (options.ignore?.tools?.includes(t.name)) {
      continue;
    }

    const parameters = z.fromJSONSchema(
      t.inputSchema as Record<string, unknown>,
    );

    tools[t.name] = tool({
      description: t.description,
      inputSchema: parameters,
      execute: async (args) => {
        return await context.executeTool(
          t.name,
          args as Record<string, unknown>,
          options,
        );
      },
    });
  }

  return {
    tools,
    readResource: async (name: string) => {
      return await context.readResource(name, options);
    },
    context,
  };
}
