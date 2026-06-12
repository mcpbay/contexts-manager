---
name: howto_build_context
description: Guide explaining how to build a context project for LLMs
title: How to Build a Context Project
mimeType: text/markdown
---

# How to Build a Context Project for LLMs

A context project is a filesystem-based directory that describes a software package, library, or domain to Large Language Models (LLMs). It enables LLMs to understand how to use the package correctly through resources, tools, and prompts.

## Directory Structure

```
my-context/
  context.json          # REQUIRED — Context configuration
  deno.json             # REQUIRED if using .ts tools/resources — Deno import map
  AGENTS.md             # OPTIONAL — Instructions for the LLM about this context
  tools/
    my-tool.ts          # TypeScript tool definitions
  resources/
    MY_RESOURCE.md      # Markdown resources with YAML frontmatter
    dynamic.ts          # TypeScript scripted resources
  prompts/
    my-prompt.md        # Prompt templates with YAML frontmatter
```

## 1. context.json (Required)

The `context.json` configuration file defines metadata and Deno permissions for the context.

```json
{
  "name": "my-context",
  "version": "1.0.0",
  "description": "Describes my awesome package for LLMs",
  "author": "you",
  "tags": ["utility", "api-reference"],
  "contextType": "mcpbay-contexts-manager",
  "deno": {
    "permissions": {
      "allowedPackages": ["npm:zod"],
      "allowedExecutables": [],
      "allowedEnvironments": [],
      "allowedReadDirs": [],
      "allowedWriteDirs": [],
      "allowNetDomains": []
    },
    "extraArguments": [],
    "timeout": 30000
  }
}
```

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Slug in lowercase, kebab-case. |
| `version` | `string` | Semver version of the context. |
| `description` | `string` | Short description of the context purpose. |
| `author` | `string` | Author name or handle. |
| `contextType` | `string?` | Must be `"mcpbay-contexts-manager"` or undefined. |
| `tags` | `string[]?` | Searchable tags for the context. |
| `deno.permissions.allowedPackages` | `string[]` | JSR/npm packages the TypeScript tools/resources can import. |
| `deno.permissions.allowedEnvironments` | `string[]` | Required env vars; context loading fails if any are missing. |
| `deno.timeout` | `number?` | Execution timeout in ms (default 5000). |

## 2. Resources (Informing the LLM)

Resources are the primary way to provide structured information to the LLM. They describe classes, interfaces, functions, types, usage patterns, architecture, and any other aspect of the project.

### Resource Granularity

Each resource must provide information about **one topic or aspect** of the project. This does not mean resources must be small — a single topic can be deep and extensive — but each resource should focus on a specific subject rather than mixing unrelated concerns.

For example, if the project being documented is an API, you could organize resources like this:

| Resource | Topic |
|---|---|
| `API_ENDPOINTS` | Endpoints, validations, request/response schemas |
| `DATABASE_DESIGN` | Database schema, migrations, relationships |
| `SECURITY` | Auth, authorization, rate limiting, encryption |
| `TESTING` | Test strategy, how to write and extend tests |
| `ARCHITECTURE` | Overall architecture, layers, patterns, data flow |
| `DEPLOYMENT` | CI/CD, environments, infrastructure |

This granularity ensures the LLM can load only the relevant resource for the task at hand, reducing noise and improving accuracy. It also makes the context maintainable — updating one topic does not require editing unrelated content.

### Nesting Resources in Folders

Resources are not required to be directly inside the `resources/` folder. They can be organized into nested subdirectories to mirror the project's own structure. This is especially useful for large projects where a flat list would be overwhelming.

For example, a monolith that includes both an API and a frontend could organize its resources like this:

```
resources/
  api/
    endpoints.md          # Endpoints, validations, request schemas
    security.md           # Auth, authorization, rate limiting
    deployment.md         # CI/CD and infrastructure
  frontend/
    components.md         # UI component library
    state-management.md   # State architecture and patterns
    routing.md            # Route design and navigation
  database/
    schema.md             # Table design and relationships
    migrations.md         # Migration strategy
  testing/
    strategy.md           # Overall testing approach
    extending-tests.md    # How to write new tests
```

Tools and prompts follow the same nesting rules — any of the `tools/`, `resources/`, and `prompts/` directories can have folders nested as deep as needed.

### Markdown Resource (Recommended)

Markdown files use YAML frontmatter for metadata:

````markdown
---
name: api_reference
description: Complete API reference of the package. Required to understand the package.
title: API Reference
mimeType: text/markdown
---

# Package Name

## Classes

### `ClassName`

Description of the class.

```typescript
const instance = new ClassName();
```
````

**Frontmatter fields:**

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Unique slug to reference the resource. |
| `description` | Yes | Short description of the resource. |
| `title` | No | Display title. |
| `mimeType` | No | MIME type (default: `text/markdown`). |

### TypeScript Script Resource

For dynamic content, use a `.ts` file that exports two functions:

```typescript
export function resourceMeta() {
  return {
    name: "api_data",
    description: "Dynamic API data",
    title: "API Data",
    mimeType: "application/json"
  };
}

export function resourceHandler() {
  return JSON.stringify({ version: "1.0.0" });
}
```

## 3. Tools (Actionable by the LLM)

Tools allow the LLM to perform actions. Each tool is a TypeScript file exporting two functions:

```typescript
import { z } from "zod";

export function toolMeta() {
  return {
    name: "my_tool",
    description: "What this tool does",
    inputSchema: z.object({
      param1: z.string().describe("Description of param1"),
    }).toJSONSchema(),
  };
}

export function toolHandler(args: Record<string, unknown>) {
  const { param1 } = args;

  return { result: `You said: ${param1}` };
}
```

**`toolMeta()` return value:**

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Tool name (lowercase, snake_case). |
| `description` | Yes | Description of what the tool does. |
| `inputSchema` | Yes | JSON Schema object (use `z.object(...).toJSONSchema()`). |
| `title` | No | Display title. |
| `outputSchema` | No | JSON Schema for output validation. |

The `name` is automatically transformed to snake_case.

## 4. Prompts (Templates for the LLM)

Prompts are Markdown files with YAML frontmatter that provide reusable prompt templates with variable interpolation:

````markdown
---
name: analyze_code
description: Analyzes a given code snippet
---

# Code Analysis Request

Please analyze the following {{language}} code:

```{{language}}
{{code}}
```
````

Variables use `{{variableName}}` syntax and are replaced at runtime by the consuming application.

## 5. Nested Subdirectories

Tools, resources, and prompts can be organized into nested subdirectories as deeply as needed. This allows you to mirror the project's own structure and keep related files together without creating a flat, hard-to-navigate list.

For example, a context for a large monolith with backend, frontend, database, and DevOps could look like:

```
my-context/
  context.json
  deno.json
  AGENTS.md
  resources/
    backend/
      api/
        endpoints.md
        middleware.md
        validators.md
      security.md
    frontend/
      components.md
      state-management.md
      routing.md
    database/
      schema.md
      migrations.md
    testing.md
    deployment.md
  tools/
    backend/
      scaffold-route.ts
      generate-migration.ts
    frontend/
      create-component.ts
    devops/
      deploy-staging.ts
  prompts/
    backend/
      explain-architecture.md
    frontend/
      review-component.md
```

**Ignored directories:** Any directory prefixed with `@` is ignored by the context loader. Use this to archive deprecated or work-in-progress content without deleting it (e.g., `@deprecated/`, `@wip/`).

## 6. AGENTS.md (Optional)

An `AGENTS.md` file at the root of the context provides additional instructions to the LLM about how to use this context. It is loaded as the `agents` property of `MCPContext`.

## Best Practices

1. **Each resource covers one topic.** Keep resources granular — one aspect of the project per resource. They can be deep and extensive, but not broad or unfocused.
2. **Maintain a `CONCEPT.md` resource.** This file should explain the project's conceptual idea — its purpose, domain, target audience, and high-level vision. It gives LLMs the context they need to understand *what* they are working on before diving into technical details.
3. **Use the resource `description` to signal reading requirements.** If a resource is a prerequisite for understanding another, say so in its description (e.g., "Required to understand the package." or "Read CONCEPT first."). This helps LLMs decide what to load.
4. **Use TypeScript tools for operations** (scaffolding, code generation, validation).
5. **Use Markdown resources for documentation.** They are simpler and don't require execution.
6. **Always provide code examples** in resources so the LLM can generate correct code.
7. **Set appropriate Deno permissions** in `context.json` — only grant what the tools actually need.
8. **Keep tools deterministic** — avoid side effects when possible, or document them clearly.
9. **Version your context** and update `context.json` when the described package changes.
