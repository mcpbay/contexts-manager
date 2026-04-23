import type { IPrompt, IResource, ITool } from "@mcpbay/easy-mcp-server/types";
import type { ITSExecuteOptions } from "../utils/ts-execute.util.ts";

export interface IContextConfig {
  name: string;
  version: string;
  description: string;
  author: string;
  tags?: string[];
  typeScript?: ITSExecuteOptions["permissions"];
}

export interface IContext {
  resources: IResource[];
  prompts: IPrompt[];
  tools: ITool[];
}