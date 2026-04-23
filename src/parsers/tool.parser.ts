import { tsExecute } from "../utils/ts-execute.util.ts";

interface ITypeScriptTool {
  /**
   * Snake case name
   */
  name: string;
  description: string;
  idempotent: boolean;
  /**
   * Human readable title
   */
  title: string;
  inputSchema: object;
  outputSchema: object;
}

export interface IToolParserResult {
  tool: ITypeScriptTool;
}

export function toolParser(filePath: string): IToolParserResult {
  const scriptContent = Deno.readTextFileSync(filePath);

  const { } = tsExecute(scriptContent, {
    cwd: Deno.cwd(),
    permissions: {},
    timeout: 2000,
    invoke: {
      function: "tool",
      arguments: [],
    },
  });

}