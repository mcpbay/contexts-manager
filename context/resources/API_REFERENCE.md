---
name: api_reference
description: Complete API reference of @mcpbay/contexts-manager
title: API Reference
mimeType: text/markdown
---

# @mcpbay/contexts-manager API Reference

A filesystem-based context management system for MCPBay. Enables creation, loading, and execution of modular MCP contexts using a directory structure on disk.

**Package**: `@mcpbay/contexts-manager`
**Runtime**: Deno (also works on Node.js/Bun via npm:jsr bridge)

---

## Exports (from `main.ts`)

### `MCPContext` (class)

The main class for managing MCP contexts — loading from disk or GitHub, executing tools, reading resources, and cleaning up temp files.

```typescript
import { MCPContext } from "@mcpbay/contexts-manager";

const context = new MCPContext({
  allowGithubContext: true,
  githubContextDestinyDirPath: "./tmp",
  githubToken: "ghp_...",
});

await context.loadContext("./my-context", options);
const result = await context.executeTool("my_tool", { arg: "value" }, options);
const content = await context.readResource("my_resource", options);
context.dispose();
```

#### Constructor

```typescript
new MCPContext(options?: Partial<IMCPContextOptions>)
```

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `options.allowGithubContext` | `boolean?` | Allow loading from `github://` URIs. |
| `options.githubContextDestinyDirPath` | `string?` | Custom directory for GitHub downloads. |
| `options.githubToken` | `string?` | GitHub token for private repos. |

#### Properties

| Property | Type | Description |
|---|---|---|
| `agents` | `string` | Content of the loaded `AGENTS.md` file (updated after `loadContext`). |
| `tools` | `IPreparedTool[]` | All loaded tools (read-only after load). |
| `resources` | `IPreparedResource[]` | All loaded resources (read-only after load). |
| `prompts` | `IPrompt[]` | All loaded prompts (read-only after load). |

#### Methods

**`loadContext(path, options)`** — Loads a context from a local directory or GitHub URI.

```typescript
loadContext(path: string, options: ITSExecuteOptions): Promise<void>
```

- `path` — Local path or `github://owner/repo[/tree/branch][/subpath]` URI.
- Detects `github://` URIs and downloads automatically via `downloadGitHubContext`.
- Validates `context.json`, environment variables, and `deno.json` presence.
- Uses `FinalizationRegistry` for automatic temp directory cleanup on GC.
- Throws if the same `path` is loaded twice.

**`executeTool(name, args, options)`** — Executes a tool by name.

```typescript
executeTool(name: string, args: Record<string, unknown>, options: ITSExecuteOptions): Promise<object | null>
```

- Finds the tool by `name` from the loaded `tools` array.
- Validates arguments against the tool's `inputSchema` (JSON Schema via Zod).
- Executes the TypeScript file, calling `toolHandler()`.
- Returns the parsed JSON response from the function.

**`readResource(name, options)`** — Reads a resource by name.

```typescript
readResource(name: string, options: ITSExecuteOptions): Promise<string>
```

- Finds the resource by `name` from the loaded `resources` array.
- If the resource is a `.ts` script, calls `resourceHandler()` and returns the string output.
- If the resource is a `.md` file, parses and returns the content after frontmatter.
- Throws if the resource didn't return a value or returned a non-string.

**`dispose()`** — Cleans up all temporary directories created by GitHub downloads.

```typescript
dispose(): void
```

### `createEmptyContext(path)` (function)

Scaffolds a complete MCP context directory with defaults and examples.

```typescript
import { createEmptyContext } from "@mcpbay/contexts-manager";

createEmptyContext("./my-context");
```

Creates the following structure:
```
<path>/
  context.json      # Default config
  deno.json         # Default import map
  AGENTS.md         # Empty
  tools/
    hello.ts        # Example: greeting_tool
  resources/
    CONCEPT.md      # Example: markdown resource
    CONCEPT.ts      # Example: script resource
  prompts/
    analyze-code.md # Example: prompt template
```

### `loadAndExecuteTool(args)` (function)

One-shot helper: load context + execute tool.

```typescript
import { loadAndExecuteTool } from "@mcpbay/contexts-manager";

const result = await loadAndExecuteTool({
  contextPath: "./my-context",
  toolName: "greeting_tool",
  args: { name: "World" },
  options,
});
```

### `loadAndReadResource(args)` (function)

One-shot helper: load context + read resource.

```typescript
import { loadAndReadResource } from "@mcpbay/contexts-manager";

const content = await loadAndReadResource({
  contextPath: "./my-context",
  resourceName: "concept",
  options,
});
```

### `loadContextFromGitHub(args)` (function)

One-shot helper: download a context from GitHub and return an `MCPContext`.

```typescript
import { loadContextFromGitHub } from "@mcpbay/contexts-manager";

const context = await loadContextFromGitHub({
  source: { owner: "user", repo: "my-context", branch: "main", path: "sub/dir" },
  options,
  destinyDir: "./tmp",
  token: "ghp_...",
});

context.dispose();
```

---

## Types & Interfaces

### `IGithubOptions`

```typescript
interface IGithubOptions {
  allowGithubContext: boolean;
  githubContextDestinyDirPath: string;
  githubToken: string;
}
```

### `IMCPContextOptions extends IGithubOptions`

Options for the `MCPContext` constructor.

### `IContextConfig`

The shape of `context.json`:

```typescript
interface IContextConfig {
  name: string;        // Slug in lowercase, snake-case
  version: string;     // Semver
  description: string; // Short description
  author: string;      // Author name
  contextType?: string; // Optional type identifier
  tags?: string[];     // Searchable tags
  deno?: Pick<ITSExecuteOptions, 'permissions' | 'extraArguments' | 'timeout'>;
}
```

### `IContext`

```typescript
interface IContext {
  agents: string;
  resources: IResource[];
  prompts: IPrompt[];
  tools: ITool[];
}
```

### `IPreparedTool extends ITool`

```typescript
interface IPreparedTool extends ITool {
  path: string;           // Absolute path to the tool .ts file
  configFilePath?: string; // Path to deno.json if present
}
```

### `IPreparedResource extends IResource`

```typescript
interface IPreparedResource extends IResource {
  path: string;           // Absolute path to the resource file
  configFilePath?: string; // Path to deno.json if present
}
```

### `IPreparedContextResponse`

```typescript
interface IPreparedContextResponse {
  resources: IPreparedResource[];
  tools: IPreparedTool[];
  prompts: IPrompt[];
  agents: string;
}
```

### `ILoadAndExecuteToolArguments`

```typescript
interface ILoadAndExecuteToolArguments {
  contextPath: string;
  toolName: string;
  args: Record<string, unknown>;
  options: ITSExecuteOptions;
}
```

### `ILoadAndReadResourceArguments`

```typescript
interface ILoadAndReadResourceArguments {
  contextPath: string;
  resourceName: string;
  options: ITSExecuteOptions;
}
```

### `ILoadContextFromGitHubArguments`

```typescript
interface ILoadContextFromGitHubArguments {
  source: IGitHubContextSource | string;
  options: ITSExecuteOptions;
  destinyDir?: string;
  token?: string;
}
```

### `ITSExecuteOptions`

Options for Deno subprocess execution of TypeScript files.

```typescript
interface ITSExecuteOptions {
  importsCwd: URL | string;      // Base URL/path for imports
  projectCwd: URL | string;      // Project root URL/path
  permissions: {
    allowedReadDirs: string[];    // Deno --allow-read dirs
    allowedWriteDirs: string[];   // Deno --allow-write dirs
    allowNetDomains: string[];    // Deno --allow-net domains
    allowedPackages: string[];    // Deno --allow-import packages
    allowedExecutables: string[]; // Deno --allow-run executables
    allowedEnvironments: string[];// Deno --allow-env variables
  };
  extraArguments: string[];       // Extra Deno CLI args
  timeout: number;                // Execution timeout in ms
  configFilePath?: string;        // Path to deno.json
  envFilePath?: string;           // Path to .env file
  invoke?: {                      // Optional function to call
    function: string;
    arguments: unknown[];
  };
}
```

### `IGitHubContextSource`

```typescript
interface IGitHubContextSource {
  owner: string;
  repo: string;
  branch?: string;  // Default: "main"
  path?: string;    // Subdirectory within the repo
  token?: string;   // GitHub token for private repos
}
```

### `IFilePathData`

```typescript
interface IFilePathData {
  fullName: string;            // e.g. "document.pdf"
  extension: string;           // e.g. ".pdf"
  nameWithoutExtension: string;// e.g. "document"
  isolatedPath: string;        // e.g. "C:/path/to"
  fullPath: string;            // e.g. "C:/path/to/document.pdf"
}
```

### `IDirectoryContent`

```typescript
interface IDirectoryContent {
  files: string[];   // List of file names
  folders: string[]; // List of directory names
}
```

### `IFrontMatterResult<T>`

```typescript
interface IFrontMatterResult<T = Record<string, unknown>> {
  data: T;      // Parsed YAML frontmatter
  content: string; // Remaining content after frontmatter
}
```

### `IBuildElement`, `IBuildFileElement`, `IBuildFolderElement`

```typescript
type IBuildElement = IBuildFolderElement | IBuildFileElement;

interface IBuildFileElement {
  type: "file";
  name: string;
  extension: string;
  content: string | object | Uint8Array;
}

interface IBuildFolderElement {
  type: "folder";
  name: string;
  files: IBuildElement[];
}
```

### `IDirEntry`

```typescript
interface IDirEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
}
```

---

## AI SDK Integration (`clients/ai.ts`)

### `loadMCP(path, options)` (function)

Loads a context and converts its tools and resources into formats compatible with Vercel's AI SDK (`ai` package).

```typescript
import { loadMCP } from "@mcpbay/contexts-manager/clients/ai";
import { generateText } from "ai";

const { tools, readResource, context } = await loadMCP("./my-context", {
  importsCwd: Deno.cwd(),
  projectCwd: Deno.cwd(),
  permissions: { allowedReadDirs: [], allowedWriteDirs: [], allowNetDomains: [], allowedPackages: [], allowedExecutables: [], allowedEnvironments: [] },
  extraArguments: [],
  timeout: 30000,
  ignore: { tools: ["secret_tool"] },
});

const result = await generateText({
  model,
  tools,
  prompt: "Use the tools",
});
```

#### `IMCPContextAiOptions extends ITSExecuteOptions`

```typescript
interface IMCPContextAiOptions extends ITSExecuteOptions {
  ignore?: {
    tools?: string[];      // Tool names to exclude
    resources?: string[];  // Resource names to exclude
    prompts?: string[];    // Prompt names to exclude
  };
}
```

#### `ILoadMCPResponse`

```typescript
interface ILoadMCPResponse {
  tools: Record<string, any>;   // AI SDK tool objects
  readResource(name: string): Promise<string>; // Read resource by name
  context: MCPContext;          // The underlying context
}
```

---

## Internal Module (`src/mod.ts`)

### `prepareContext(path, options)` (function)

Core function that reads `context.json`, validates configuration, and lists all tools, resources, and prompts from the directory.

```typescript
import { prepareContext } from "./src/mod.ts";

const result = await prepareContext("./my-context", options);
// result.resources, result.tools, result.prompts, result.agents
```

### `MCPBAY_CONTEXTS_MANAGER_CONTEXT_TYPE` (constant)

```typescript
const MCPBAY_CONTEXTS_MANAGER_CONTEXT_TYPE = "mcpbay-contexts-manager";
```

Used to validate the `contextType` field in `context.json`.

---

## Internal Utilities (`src/utils/`)

### `build.util.ts`

**`build(destPath, elements)`** — Recursively builds a directory structure from a list of `IBuildElement` entries. Creates folders and writes files (string, object JSON, or Uint8Array content).

### `crash-if-not.util.ts`

**`crashIfNot(condition, message)`** — Asserts a condition; throws `Error(message)` if falsy. Used as a type guard.

### `exists.util.ts`

**`exists(path, isDir?)`** — Checks if a path exists in the filesystem. `isDir = true` checks for directory existence; `false` (default) checks for file existence.

### `expand-tilde.util.ts`

**`expandTilde(path)`** — Expands `~` to the user's home directory (`HOME` or `USERPROFILE` env var). Returns `null` if home is not set.

### `extract-file-path-data.util.ts`

**`extractFilePathData(path)`** — Extracts `IFilePathData` from a file path (string or `file://` URI): basename, extension, dirname, absolute path.

### `fs.util.ts`

Cross-runtime filesystem utilities (works on Deno, Node.js, Bun).

| Function | Description |
|---|---|
| `statSync(filePath)` | File stat |
| `writeFileSync(filePath, data)` | Write file (string or Uint8Array) |
| `mkdirSync(dir, options?)` | Create directory (recursive) |
| `readDirSync(resolvedPath)` | Read directory entries with type info |
| `makeTempFileSync(suffix)` | Create temp file with unique name |
| `writeTextFileSync(filePath, content)` | Write text file (sync) |
| `readTextFile(filePath)` | Read text file (async) |
| `readTextFileSync(filePath)` | Read text file (sync) |
| `makeTempDirSync()` | Create temp directory |
| `removeSync(filePath)` | Remove file/dir recursively |
| `cwd()` | Current working directory |
| `envGet(key)` | Get env var |
| `envHas(key)` | Check env var exists |
| `envSet(key, value)` | Set env var |
| `envDelete(key)` | Delete env var |
| `createDenoCommand(args, options)` | Spawn Deno process with piped stdio |

### `generate-temp-file.util.ts`

**`generateTempFile(content)`** — Creates a temporary `.ts` file with the given content. Returns the temp file path.

### `get-basename.util.ts`

**`getBasename(path)`** — Returns the basename of a path, handling `file://` URIs.

### `get-directory-content.util.ts`

**`getDirectoryContent(path)`** — Reads a directory and returns `IDirectoryContent` (lists of files and folders). Uses `readDirSync` internally.

### `parse-front-matter.util.ts`

**`parseFrontMatter(filePath)`** — Reads a file and parses YAML frontmatter between `---` delimiters. Returns `IFrontMatterResult<T>`.

### `read-file.util.ts`

**`readFile(filePath)`** — Async file reader (wraps `readTextFile` from fs.util).

### `read-json-from-file.util.ts`

**`readJsonFromFile(path)`** — Reads and parses a JSON file synchronously.

### `read-text-file.util.ts`

**`readTextFile(path)`** — Reads a text file synchronously (resolves the path first).

### `resolve-path.util.ts`

**`resolvePath(path, basePath?)`** — Resolves a path (string or URL) to an absolute filesystem path. Handles `file://` URIs, relative paths, and absolute paths.

### `download-github-context.util.ts`

**`parseGitHubURI(uri)`** — Parses `github://owner/repo[/tree/branch][/subpath]` into `IGitHubContextSource`.

**`downloadGitHubContext(source, destDir?)`** — Downloads all files from a GitHub repo subdirectory using the GitHub Contents API. Recursively fetches directories. Accepts optional `GITHUB_TOKEN` via parameter or `GITHUB_TOKEN` env var.

### `ts-execute.util.ts`

**`executeTypeScriptFile(scriptPath, options)`** — Reads a TypeScript file, optionally appends invocation code (calling an exported function and `console.log`-ing JSON result), writes to a temp file, spawns `deno run` with calculated permissions, and returns stdout.

---

## Internal Transformers (`src/transformers/`)

### `to-object.transformer.ts`

**`toObject(text)`** — Safely parses JSON string. Returns `null` instead of throwing.

### `to-snake-case.transformer.ts`

**`toSnakeCase(str)`** — Converts camelCase, PascalCase, kebab-case to snake_case. Used by tool name validation.

---

## Internal Validators (`src/validators/`)

### `is-context-config.validator.ts`

**`isContextConfig(value)`** — Type guard that checks if a value is a valid `IContextConfig` (plain object with string name/version/description/author and array tags).

### `is-script-resource.validator.ts`

**`isScriptResource(filePath)`** — Returns `true` if the file path ends with `.ts`.

### `is-valid-file-uri.validator.ts`

**`isValidFileURI(path)`** — Checks if a string starts with `file://` and has the `file:` protocol.

---

## Context Directory Structure

A context is a directory on the filesystem with this layout:

```
my-context/
  context.json          # Configuration (required)
  deno.json             # Deno import map (required if .ts files exist)
  AGENTS.md             # Instructions for the LLM (optional)
  tools/
    hello.ts            # TypeScript tool definition
    subfolder/
      nested-tool.ts    # Nested tools
  resources/
    CONCEPT.md          # Markdown resource with YAML frontmatter
    data.ts             # TypeScript scripted resource
  prompts/
    analyze-code.md     # Prompt template
```

### context.json Schema

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Slug in lowercase, snake-case. |
| `version` | `string` | Semver version. |
| `description` | `string` | Short description. |
| `author` | `string` | Author name. |
| `contextType` | `string?` | Must be `"mcpbay-contexts-manager"` or undefined. |
| `tags` | `string[]?` | Searchable tags. |
| `deno` | `object?` | Deno permissions and execution settings. |

### Tool File Format (`.ts`)

Each tool file must export two functions:

```typescript
import { z } from "zod";

export function toolMeta() {
  return {
    name: "greeting_tool",              // Lowercase, auto snake_case
    description: "Give me a greeting",
    title: "Greeting Tool",             // Optional display name
    inputSchema: z.object({
      name: z.string().describe("Name"),
    }).toJSONSchema(),
    outputSchema: z.object({            // Optional client-side validation
      greeting: z.string(),
    }).toJSONSchema(),
  };
}

export function toolHandler(args: Record<string, unknown>) {
  const { name } = args;
  return { greeting: `Hello, ${name}!` };
}
```

### Resource File Formats

**Markdown (`.md`)**:

```markdown
---
name: concept
description: My useful resource
title: Concept
mimeType: text/markdown
---

# Content here
```

**TypeScript (`.ts`)**:

```typescript
export function resourceMeta() {
  return {
    name: "data",
    description: "My useful resource",
    title: "Data",
    mimeType: "text/plain",
  };
}

export function resourceHandler() {
  return "Dynamic content";
}
```

### Prompt File Formats

**Markdown (`.md`)**:

```markdown
---
name: analyze_code
description: Analyzes a given code snippet
---

# Request

Please analyze {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`
```

**TypeScript (`.ts`)**:

```typescript
export function promptMeta() {
  return {
    name: "my_prompt",
    description: "My prompt",
    title: "My Prompt",
  };
}
```

---

## GitHub URI Format

```
github://owner/repo[/tree/branch][/subpath]
```

Examples:
- `github://mcpbay/awesome-context` — default branch `main`, root directory
- `github://user/repo/tree/dev/path/to/context` — branch `dev`, subdirectory `path/to/context`

---

## Deno Permissions

When executing TypeScript files, the library constructs Deno CLI arguments based on the `permissions` object:

- **`--allow-read`**: Always includes `./` and the temp directory + user-specified dirs
- **`--allow-write`**: Always includes `./` and the temp directory + user-specified dirs
- **`--allow-net`**: Only if `allowNetDomains` is non-empty
- **`--allow-run`**: Only if `allowedExecutables` is non-empty
- **`--allow-env`**: User-specified env vars + `TMPDIR`, `TMP`, `TEMP`
- **`--config`**: If `configFilePath` is provided
- **`--env`**: If `envFilePath` is provided (also adds `--allow-env`)

---

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@mcpbay/easy-mcp-server` | ^1.2.2 | MCP types (`ITool`, `IResource`, `IPrompt`) |
| `@online/is` | ^0.0.6 | Type checking utilities |
| `@online/runtime` | ^0.1.2 | Runtime detection (Deno/Node/Bun) |
| `@std/assert` | ^1.0.19 | Assertions |
| `@std/path` | ^1.1.5 | Path manipulation |
| `@std/yaml` | ^1.1.1 | YAML parsing for frontmatter |
| `ai` | ^6.0.168 | Vercel AI SDK integration |
| `zod` | ^4.4.3 | Schema validation |
