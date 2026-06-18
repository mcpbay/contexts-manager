import type { IPrompt, IResource, ITool } from "@mcpbay/easy-mcp-server/types";
import type { ITSExecuteOptions } from "../utils/deno-run.util.ts";

export interface IContextConfig {
  /**
   * Human readable name.
   */
  name: string;
  /**
   * Slug in lowercase, it can be a kebab-case or snake-case.
   */
  slug: string;
  /**
   * semver version.
   */
  version: string;
  /**
   * A description.
   */
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
