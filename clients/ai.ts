import { tool } from "ai";
import * as z from "zod";
import { MCPContext } from "../main.ts";
import type { ITSExecuteOptions } from "../src/utils/deno-run.util.ts";

export interface IMCPContextAiOptions extends ITSExecuteOptions {
  ignore?: {
    tools?: string[];
    resources?: string[];
    prompts?: string[];
  };
}

export interface ILoadMCPResponse {
  // deno-lint-ignore no-explicit-any
  tools: Record<string, any>;
  readResource(name: string): Promise<string>;
  context: MCPContext;
}

export async function loadMCP(
  path: string,
  options: IMCPContextAiOptions,
): Promise<ILoadMCPResponse> {
  const context = new MCPContext();
  // deno-lint-ignore no-explicit-any
  const tools: Record<string, any> = {};

  await context.loadContext(path, options);

  for (const t of context.tools) {
    const isToolIgnored = options.ignore?.tools?.includes(t.name);

    if (isToolIgnored) {
      continue;
    }

    const parameters = z.fromJSONSchema(
      t.inputSchema as Record<string, unknown>,
    );

    tools[t.name] = tool({
      description: t.description,
      inputSchema: parameters,
      execute: async (args) => {
        const result = await context.executeTool(
          t.name,
          args as Record<string, unknown>,
          options,
        );

        return result;
      },
    });
  }

  return {
    tools,
    readResource: async (name: string) => {
      const result = await context.readResource(name, options);

      return result;
    },
    context,
  };
}
