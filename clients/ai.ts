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
 * Loads an MCP context and prepares it for use with Vercel's AI SDK.
 * 
 * This function initializes an MCPContext from the given path and converts 
 * its tools and resources into a format compatible with `generateText` and other 
 * AI SDK functions.
 * 
 * @param path The absolute path to the MCP context directory.
 * @param options Execution options and optional ignore filters.
 * @returns An object containing `tools` and a `system` prompt addition.
 */
export async function loadMCP(path: string, options: IMCPContextAiOptions) {
  const context = new MCPContext();
  const tools: Record<string, any> = {};

  await context.loadContext(path, options);

  for (const t of context.tools) {
    if (options.ignore?.tools?.includes(t.name)) {
      continue;
    }

    // Use z.fromJSONSchema if available (as seen in main.ts)
    const parameters = z.fromJSONSchema(t.inputSchema as Record<string, unknown>);

    tools[t.name] = tool({
      description: t.description,
      inputSchema: parameters,
      execute: async (args) => {
        return await context.executeTool(t.name, args as Record<string, unknown>, options);
      },
    });
  }

  let system = "";

  const activeResources = context.resources.filter(
    (r) => !options.ignore?.resources?.includes(r.name)
  );

  if (activeResources.length > 0) {
    system += "### MCP Resources\n\n";
    system += "Use the following resources as additional context for your task:\n\n";
    for (const r of activeResources) {
      const content = await context.readResource(r.name, options);
      system += `#### ${r.name}\n${content}\n\n`;
    }
  }

  // Handle prompts if they were implemented in the context (future-proofing)
  const activePrompts = (context.prompts || []).filter(
    (p) => !options.ignore?.prompts?.includes(p.name)
  );

  if (activePrompts.length > 0) {
    if (system) system += "\n";
    system += "### Available Prompts\n\n";
    for (const p of activePrompts) {
      system += `- ${p.name}: ${p.description}\n`;
    }
  }

  return {
    tools,
    system: system.trim(),
    context,
  };
}
