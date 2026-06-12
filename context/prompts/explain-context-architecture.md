---
name: explain_context_architecture
description: Explains the architecture of @mcpbay/contexts-manager and how contexts work
---

# Contexts Manager Architecture

Explain the architecture of the `@mcpbay/contexts-manager` package, focusing on:

1. The `MCPContext` class and its lifecycle (load → execute/read → dispose).
2. The context directory structure and what each file does.
3. How tools, resources, and prompts are defined and loaded.
4. How GitHub-based contexts are downloaded and managed.
5. How the AI SDK integration (`clients/ai.ts`) bridges MCP contexts with Vercel's AI SDK.
6. The permission system for Deno subprocess execution.
