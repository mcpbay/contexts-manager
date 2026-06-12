import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";

const MCPBAY_CONTEXTS_MANAGER_CONTEXT_TYPE = "mcpbay-contexts-manager";

interface IBuildElement {
  type: "file" | "folder";
  name: string;
  extension?: string;
  content?: string | object;
  files?: IBuildElement[];
}

function build(destPath: string, elements: IBuildElement[]) {
  for (const element of elements) {
    if (element.type === "file") {
      const filePath = `${destPath}/${element.name}.${element.extension}`;
      const content = typeof element.content === "object"
        ? JSON.stringify(element.content, null, 2)
        : element.content ?? "";

      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, "utf-8");
    } else {
      const folderPath = `${destPath}/${element.name}`;

      fs.mkdirSync(folderPath, { recursive: true });
      if (element.files) {
        build(folderPath, element.files);
      }
    }
  }
}

export function toolMeta() {
  return {
    name: "init_context",
    description: "Scaffolds a new MCP context project directory with default configuration files, example tools, resources, and prompts. Creates context.json, deno.json, AGENTS.md, and populated tools/, resources/, prompts/ directories.",
    title: "Initialize Context Project",
    inputSchema: z.object({
      path: z.string().describe("Destination path where the context directory will be created."),
      name: z.string().optional().describe("Context name slug (lowercase). Default: 'my-context'."),
      description: z.string().optional().describe("Short description of the context. Default: 'A useful context for MCPBay!'."),
      author: z.string().optional().describe("Author name. Default: 'mcpbay'."),
    }).toJSONSchema(),
  };
}

export function toolHandler(args: Record<string, string>) {
  const { path: destPath, name, description, author } = args;

  const projectName = name ?? "my-context";

  const DEFAULT_DENO_JSON_CONTENT = {
    tasks: {},
    imports: {
      "@std/assert": "jsr:@std/assert@1",
      "zod": "npm:zod@^4.3.6",
      "@std/path": "jsr:@std/path@^1.1.5",
      "@online/is": "jsr:@online/is@^0.0.6",
    },
  };

  const DEFAULT_CONTEXT_JSON_CONTENT = {
    name: projectName,
    version: "1.0.0",
    description: description ?? "A useful context for MCPBay!",
    author: author ?? "mcpbay",
    tags: [],
    deno: {
      permissions: {
        allowedPackages: ["jsr:@std/assert", "npm:zod", "jsr:@std/path", "jsr:@online/is"],
        allowedExecutables: [],
        allowedEnvironments: [],
        allowedReadDirs: [],
        allowedWriteDirs: [],
        allowNetDomains: [],
      },
      extraArguments: [],
      timeout: 5000,
    },
    contextType: MCPBAY_CONTEXTS_MANAGER_CONTEXT_TYPE,
  };

  const DEFAULT_RESOURCE_EXAMPLE_CONTENT = `---
name: concept
description: My useful resource
title: Concept
mimeType: text/markdown
---
# Example

Resource content goes here. Describe your package's classes, interfaces, functions, and usage patterns.
`;

  const DEFAULT_TOOL_EXAMPLE_CONTENT = `import { z } from "zod";

export function toolMeta() {
  return {
    name: "my_tool",
    description: "Describe what this tool does",
    title: "My Tool",
    inputSchema: z.object({
      input: z.string().describe("Describe the input parameter"),
    }).toJSONSchema(),
  };
}

export function toolHandler(args: Record<string, unknown>) {
  const { input } = args;

  return {
    result: \`You provided: \${input}\`,
  };
}
`;

  const DEFAULT_PROMPT_EXAMPLE_CONTENT = `---
name: explain_concept
description: Explains a concept or code pattern
---

# Concept Explanation

Please explain the following concept in detail, providing examples and use cases:

{{concept}}
`;

  build(destPath, [
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
    {
      type: "file",
      name: "AGENTS",
      extension: "md",
      content: `# ${projectName} Context

This context describes the **${projectName}** package for LLMs.

## Resources
- **CONCEPT** — Main resource describing the package.

## Tools
- **my_tool** — Example tool.

## Prompts
- **explain_concept** — Explains a concept.
`,
    },
    { type: "folder", name: "tools", files: [
      {
        type: "file",
        name: "my-tool",
        extension: "ts",
        content: DEFAULT_TOOL_EXAMPLE_CONTENT,
      },
    ] },
    { type: "folder", name: "resources", files: [
      {
        type: "file",
        name: "CONCEPT",
        extension: "md",
        content: DEFAULT_RESOURCE_EXAMPLE_CONTENT,
      },
    ] },
    { type: "folder", name: "prompts", files: [
      {
        type: "file",
        name: "explain-concept",
        extension: "md",
        content: DEFAULT_PROMPT_EXAMPLE_CONTENT,
      },
    ] },
  ]);

  return {
    status: "completed",
    message: `Context project initialized at "${destPath}".`,
    structure: {
      config: "context.json, deno.json, AGENTS.md",
      tools: ["tools/my-tool.ts"],
      resources: ["resources/CONCEPT.md"],
      prompts: ["prompts/explain-concept.md"],
    },
  };
}
