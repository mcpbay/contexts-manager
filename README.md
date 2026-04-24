# @mcpbay/contexts-manager

A core library for managing and preparing MCP (Model Context Protocol) contexts, providing tools for execution, resource management, and AI SDK integration.

## Core Exports

### MCPContext

The main class used to manage multiple MCP contexts, execute tools, and retrieve resources or prompts.

#### Properties

- `tools: IPreparedTool[]`: An array of prepared tools loaded into the context.
- `resources: IPreparedResource[]`: An array of prepared resources loaded into the context.
- `prompts: IPrompt[]`: An array of prompts loaded into the context.

#### Methods

- `loadContext(path: string, options: ITSExecuteOptions): Promise<void>`
  Loads an MCP context from the specified directory path. It reads the `context.json` and `deno.json` files, then recursively crawls the `tools`, `resources`, and `prompts` directories to prepare the context for use.

- `executeTool(name: string, args: Record<string, unknown>, options: ITSExecuteOptions): Promise<object | null>`
  Executes a specific tool by name with the provided arguments. The tool implementation (a TypeScript file) is executed in a sub-process with permissions defined in the context configuration. The arguments are validated against the tool's input schema before execution.

- `readResource(name: string, options: ITSExecuteOptions): Promise<string>`
  Reads the content of a specific resource by name. If the resource is a static file (e.g., Markdown), its content is returned. If the resource is a TypeScript script, it is executed, and its return value is captured and returned as a string.

### createEmptyContext

`createEmptyContext(path: string): void`

Creates a new MCPBay context structure in the specified path. This includes generating a `context.json`, `deno.json`, and the necessary directory structure for tools, resources, and prompts, populated with examples.

### loadAndExecuteTool

`loadAndExecuteTool(args: ILoadAndExecuteToolArguments): Promise<object | null>`

A convenience function that initializes a context, loads it from a specified path, and executes a tool in a single operation. This is useful for one-off tool executions without maintaining a persistent context instance.

### loadAndReadResource

`loadAndReadResource(args: ILoadAndReadResourceArguments): Promise<string>`

A convenience function that initializes a context, loads it from a specified path, and reads a resource in a single operation. Useful for quickly retrieving resource content.

## AI Client Exports

### loadMCP

`loadMCP(path: string, options: IMCPContextAiOptions): Promise<ILoadMCPResponse>`

Loads an MCP context and prepares it for use with Vercel's AI SDK. It converts tools into a format compatible with the `tool()` function from the `ai` package, allowing them to be passed directly to `generateText` or `streamText`. It also provides a utility for reading resources by name.

## Interfaces and Types

### ILoadAndExecuteToolArguments

- `contextPath: string`: Absolute path to the MCP context.
- `toolName: string`: Name of the tool to execute.
- `args: Record<string, unknown>`: Arguments to pass to the tool.
- `options: ITSExecuteOptions`: Execution options.

### ILoadAndReadResourceArguments

- `contextPath: string`: Absolute path to the MCP context.
- `resourceName: string`: Name of the resource to read.
- `options: ITSExecuteOptions`: Execution options.

### ITSExecuteOptions

Options for TypeScript file execution, including environment permissions and configuration file paths.

- `importsCwd: URL | string`: The base path for resolving imports.
- `projectCwd: URL | string`: The working directory for the execution process.
- `permissions`: Security permissions for the execution:
  - `allowedReadDirs: string[]`: List of directories allowed for reading.
  - `allowedWriteDirs: string[]`: List of directories allowed for writing.
  - `allowNetDomains: string[]`: List of domains allowed for network access.
  - `allowedPackages: string[]`: List of allowed external packages.
  - `allowedExecutables: string[]`: List of allowed executables for subprocesses.
  - `allowedEnvironments: string[]`: List of allowed environment variables.
- `extraArguments: string[]`: Additional command-line arguments for the Deno process.
- `timeout: number`: Execution timeout in milliseconds.
- `configFilePath?: string`: Optional path to a Deno configuration file.
- `envFilePath?: string`: Optional path to an environment file.
- `invoke?`: Optional function invocation details:
  - `function: string`: Name of the function to invoke.
  - `arguments: unknown[]`: Arguments to pass to the function.

### IPreparedTool

Extends the base `ITool` interface with additional properties:
- `path`: The absolute file path to the tool implementation.
- `configFilePath`: Optional path to the Deno configuration file.

### IPreparedResource

Extends the base `IResource` interface with additional properties:
- `path`: The absolute file path to the resource.
- `configFilePath`: Optional path to the Deno configuration file.

### IMCPContextAiOptions

Extends `ITSExecuteOptions` with filtering capabilities:
- `ignore`: Optional object containing arrays of `tools`, `resources`, and `prompts` names to exclude from loading.

### ILoadMCPResponse

The response object returned by `loadMCP`:
- `tools`: A record of tools compatible with Vercel's AI SDK.
- `readResource(name: string): Promise<string>`: Function to read resource content.
- `context`: The underlying `MCPContext` instance.
