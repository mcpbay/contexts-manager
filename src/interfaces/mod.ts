import type { IPrompt, IResource, ITool } from "@mcpbay/easy-mcp-server/types";
import type { ITSExecuteOptions } from "../utils/ts-execute.util.ts";

export interface IContextConfig {
  /**
   * Slug in lowercase, snake-case.
   */
  name: string;
  version: string;
  description: string;
  author: string;
  contextType?: string;
  tags?: string[];
  deno?: Pick<ITSExecuteOptions, 'permissions' | 'extraArguments' | 'timeout'>;
}

export interface IContext {
  agents: string;
  resources: IResource[];
  prompts: IPrompt[];
  tools: ITool[];
}
