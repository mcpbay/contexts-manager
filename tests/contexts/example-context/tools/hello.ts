import { z } from "zod";

export function toolMeta() {
  return {
    name: "greeting_tool",
    description: "Give me a greeting",
    title: "Greeting Tool",
    inputSchema: z.object({
      name: z.string().describe("The name to greet"),
    }).toJSONSchema(),
  };
}

export function toolHandler(args: Record<string, string>) {
  const { name } = args;

  return {
    greeting: `Hello, ${name}! Welcome to the example MCPBay context.`,
  };
}
