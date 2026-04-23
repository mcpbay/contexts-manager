import { assertEquals, assertExists } from "@std/assert";
import { join } from "@std/path";
import { createEmptyContext } from "../main.ts";

Deno.test("createEmptyContext - Success: Creates initial structure", () => {
  const tempDir = Deno.makeTempDirSync();
  try {
    createEmptyContext(tempDir);

    // Check main files
    const contextJsonPath = join(tempDir, "context.json");
    const denoJsonPath = join(tempDir, "deno.json");

    assertExists(Deno.statSync(contextJsonPath));
    assertExists(Deno.statSync(denoJsonPath));

    // Check folders
    assertExists(Deno.statSync(join(tempDir, "tools")));
    assertExists(Deno.statSync(join(tempDir, "resources")));
    assertExists(Deno.statSync(join(tempDir, "prompts")));

    // Check resource files
    assertExists(Deno.statSync(join(tempDir, "resources", "CONCEPT.md")));
    assertExists(Deno.statSync(join(tempDir, "resources", "CONCEPT.ts")));

    // Check tool files
    assertExists(Deno.statSync(join(tempDir, "tools", "hello.ts")));

    // Verify content of context.json
    const contextJson = JSON.parse(Deno.readTextFileSync(contextJsonPath));
    assertEquals(contextJson.version, "1.0.0");
    assertEquals(contextJson.description, "A useful context for MCPBay!");

    // Verify content of deno.json
    const denoJson = JSON.parse(Deno.readTextFileSync(denoJsonPath));
    assertExists(denoJson.imports["@std/assert"]);
    assertExists(denoJson.imports["zod"]);
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});

Deno.test("createEmptyContext - Failure: Path is an existing file", () => {
  const tempFile = Deno.makeTempFileSync();
  try {
    // Should throw because it tries to mkdirSync on an existing file
    try {
      createEmptyContext(tempFile);
      throw new Error("Should have thrown");
    } catch (e) {
      // Deno error for "Already exists" or "Not a directory"
      assertExists(e);
    }
  } finally {
    Deno.removeSync(tempFile);
  }
});

Deno.test("createEmptyContext - Success: Directory already exists", () => {
  const tempDir = Deno.makeTempDirSync();
  try {
    // Calling it twice should work (mkdirSync check)
    createEmptyContext(tempDir);
    createEmptyContext(tempDir);

    assertExists(Deno.statSync(join(tempDir, "context.json")));
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});
