# @mcpbay/contexts-manager

A filesystem-based context management system for MCPBay. It enables the creation, loading, and execution of modular MCP (Model Context Protocol) contexts using a directory structure on disk.

## Installation

```bash
npx jsr add @mcpbay/contexts-manager
```

Or using Deno:

```bash
deno add jsr:@mcpbay/contexts-manager
```

## Context Structure

A context is a directory on the filesystem with the following layout:

```
my-context/
  context.json          # Context configuration (required)
  deno.json             # Deno import map for TypeScript files (required if using .ts tools/resources)
  tools/
    hello.ts            # TypeScript tool definition
    subfolder/
      nested-tool.ts    # Tools can be nested in subdirectories
  resources/
    CONCEPT.md          # Markdown resource with frontmatter
    data.ts             # TypeScript resource (scripted)
  prompts/              # Reserved for future use
```

### context.json

```json
{
  "name": "my-context",
  "version": "1.0.0",
  "description": "A useful context for MCPBay",
  "author": "godperson1",
  "tags": ["utility"],
  "typeScript": {
    "allowedPackages": ["jsr:@std/assert", "npm:zod"],
    "allowedExecutables": [],
    "allowedDomains": [],
    "allowedEnvs": [],
    "allowRead": false,
    "allowWrite": false,
    "extraArguments": []
  }
}
```

### Tools

Tools are TypeScript files placed in the `tools/` directory. Each tool file must export two functions:

```ts
import { z } from "zod";

export function toolMeta() {
  return {
    name: "greeting_tool",
    description: "Give me a greeting",
    inputSchema: z.object({
      name: z.string().describe("Name"),
    }).toJSONSchema(),
  };
}

export function toolHandler(args: Record<string, string>) {
  const { name } = args;

  return {
    greeting: `Hello, ${name}!`,
  };
}
```

Tools can be organized in nested subdirectories. Directories prefixed with `@` are ignored.

### Resources

Resources can be either Markdown files with YAML frontmatter or TypeScript script resources.

**Markdown resource** (`resources/CONCEPT.md`):

```markdown
---
name: concept
description: My useful resource
title: Concept
mimeType: text/markdown
---

# Concept

Resource content goes here.
```

**TypeScript resource** (`resources/data.ts`):

```ts
export function resourceMeta() {
  return {
    name: "data",
    description: "My useful resource",
    title: "Data",
    mimeType: "text/plain",
  };
}

export function resourceHandler() {
  return "Dynamic resource content";
}
```

## Usage

### Creating a new context

```ts
import { createEmptyContext } from "@mcpbay/contexts-manager";

createEmptyContext("./my-context");
```

This scaffolds a complete context directory with default configuration and example files.

### Loading and using a context

```ts
import { MCPContext } from "@mcpbay/contexts-manager";

const context = new MCPContext();

await context.loadContext("./my-context", {
  importsCwd: Deno.cwd(),
  projectCwd: Deno.cwd(),
  permissions: {
    allowedReadDirs: [Deno.cwd()],
    allowedWriteDirs: [],
    allowNetDomains: [],
    allowedPackages: [],
    allowedExecutables: [],
    allowedEnvironments: [],
  },
  extraArguments: [],
  timeout: 30000,
});

// Execute a tool
const result = await context.executeTool("greeting_tool", { name: "World" }, options);

// Read a resource
const content = await context.readResource("concept", options);
```

### Quick load-and-execute helpers

```ts
import { loadAndExecuteTool, loadAndReadResource } from "@mcpbay/contexts-manager";

const toolResult = await loadAndExecuteTool({
  contextPath: "./my-context",
  toolName: "greeting_tool",
  args: { name: "World" },
  options,
});

const resourceContent = await loadAndReadResource({
  contextPath: "./my-context",
  resourceName: "concept",
  options,
});
```

### AI SDK integration

```ts
import { loadMCP } from "@mcpbay/contexts-manager/clients/ai";
import { generateText } from "ai";

const { tools, readResource } = await loadMCP("./my-context", options);

const result = await generateText({
  model,
  tools,
  prompt: "Use the greeting tool to say hello",
});
```

## License

MIT
