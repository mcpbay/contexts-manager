import { expect, test } from "@libs/testing";
import { join } from "@std/path";
import type { ITSExecuteOptions } from "../src/utils/deno-run.util.ts";
import {
  cwd,
  envGet,
  envSet,
  makeTempDirSync,
  readTextFileSync,
  removeSync,
} from "../src/utils/fs.util.ts";
import { exists } from "../src/utils/exists.util.ts";
import { loadContextFromGitHub, MCPContext } from "../main.ts";
import {
  type IGitHubContextSource,
  parseGitHubURI,
} from "../src/utils/download-github-context.util.ts";
import { DENO_PERMISSIONS } from "./constants.ts";

const projectRoot = cwd();
const GITHUB_URI =
  "github://mcpbay/contexts-manager/tree/main/tests/contexts/example-context";

const baseOptions: ITSExecuteOptions = {
  importsCwd: projectRoot,
  projectCwd: projectRoot,
  permissions: {
    allowedReadDirs: [projectRoot],
    allowedWriteDirs: [],
    allowNetDomains: [
      "api.github.com",
      "raw.githubusercontent.com",
      "github.com",
    ],
    allowedPackages: ["jsr:@std/assert", "npm:zod"],
    allowedExecutables: [],
    allowedEnvironments: [],
  },
  extraArguments: [],
  timeout: 30000,
  configFilePath: join(projectRoot, "jsr.json"),
};

const GITHUB_PERMISSIONS = {
  permissions: { env: true, write: true, read: true, run: true, net: true },
};

test(
  "parseGitHubURI - Parses a standard owner/repo URI",
  () => {
    const result = parseGitHubURI("github://mcpbay/contexts-manager");

    expect(result.owner).toBe("mcpbay");
    expect(result.repo).toBe("contexts-manager");
    expect(result.branch).toBe("main");
    expect(result.path).toBe("");
  },
  DENO_PERMISSIONS,
);

test(
  "parseGitHubURI - Parses a URI with branch",
  () => {
    const result = parseGitHubURI(
      "github://mcpbay/contexts-manager/tree/develop",
    );

    expect(result.owner).toBe("mcpbay");
    expect(result.repo).toBe("contexts-manager");
    expect(result.branch).toBe("develop");
    expect(result.path).toBe("");
  },
  DENO_PERMISSIONS,
);

test(
  "parseGitHubURI - Parses a URI with branch and subpath",
  () => {
    const result = parseGitHubURI(GITHUB_URI);

    expect(result.owner).toBe("mcpbay");
    expect(result.repo).toBe("contexts-manager");
    expect(result.branch).toBe("main");
    expect(result.path).toBe("tests/contexts/example-context");
  },
  DENO_PERMISSIONS,
);

test(
  "parseGitHubURI - Parses a URI with subpath but no explicit branch (defaults to main)",
  () => {
    const result = parseGitHubURI(
      "github://mcpbay/contexts-manager/tests/contexts/example-context",
    );

    expect(result.owner).toBe("mcpbay");
    expect(result.repo).toBe("contexts-manager");
    expect(result.branch).toBe("main");
    expect(result.path).toBe("tests/contexts/example-context");
  },
  DENO_PERMISSIONS,
);

test(
  "parseGitHubURI - Throws on invalid URI (only owner, no repo)",
  () => {
    expect(() => parseGitHubURI("github://mcpbay")).toThrow();
  },
  DENO_PERMISSIONS,
);

test(
  "GitHub context - loadContextFromGitHub loads the example context from GitHub",
  async () => {
    const context = await loadContextFromGitHub({
      source: GITHUB_URI,
      options: baseOptions,
    });

    try {
      expect(context.tools.length).toBe(1);
      expect(context.resources.length).toBe(2);
      expect(context.prompts.length).toBe(2);

      const tool = context.tools.find((t) => t.name === "greeting_tool");
      expect(tool).toBeTruthy();
      expect(tool!.description).toBe("Give me a greeting");

      const greetPrompt = context.prompts.find((p) => p.name === "greet_user");
      expect(greetPrompt).toBeTruthy();
      expect(greetPrompt!.description).toBe(
        "Generates a welcome message for a given user",
      );

      const reportPrompt = context.prompts.find((p) =>
        p.name === "generate_report"
      );
      expect(reportPrompt).toBeTruthy();
      expect(reportPrompt!.description).toBe(
        "Generates a report in the specified format",
      );
    } finally {
      context.dispose();
    }
  },
  GITHUB_PERMISSIONS,
);

test(
  "GitHub context - Executes the greeting tool from GitHub-loaded context",
  async () => {
    const context = await loadContextFromGitHub({
      source: GITHUB_URI,
      options: baseOptions,
    });

    try {
      const result = await context.executeTool(
        "greeting_tool",
        { name: "TestUser" },
        baseOptions,
      );

      expect(result).toBeTruthy();
      expect((result as Record<string, unknown>).greeting).toBe(
        "Hello, TestUser! Welcome to the example MCPBay context.",
      );
    } finally {
      context.dispose();
    }
  },
  GITHUB_PERMISSIONS,
);

test(
  "GitHub context - Reads the markdown resource from GitHub-loaded context",
  async () => {
    const context = await loadContextFromGitHub({
      source: GITHUB_URI,
      options: baseOptions,
    });

    try {
      const content = await context.readResource("readme", baseOptions);

      expect(content).toContain("markdown resource for the example");
    } finally {
      context.dispose();
    }
  },
  GITHUB_PERMISSIONS,
);

test(
  "GitHub context - loadContextFromGitHub with IGitHubContextSource object",
  async () => {
    const source: IGitHubContextSource = {
      owner: "mcpbay",
      repo: "contexts-manager",
      branch: "main",
      path: "tests/contexts/example-context",
    };

    const context = await loadContextFromGitHub({
      source,
      options: baseOptions,
    });

    try {
      expect(context.tools.length).toBe(1);
      expect(context.resources.length).toBe(2);

      const result = await context.executeTool(
        "greeting_tool",
        { name: "GitHubUser" },
        baseOptions,
      );

      expect(result).toBeTruthy();
      expect((result as Record<string, unknown>).greeting).toBe(
        "Hello, GitHubUser! Welcome to the example MCPBay context.",
      );
    } finally {
      context.dispose();
    }
  },
  GITHUB_PERMISSIONS,
);

test(
  "GitHub context - MCPContext.loadContext with github:// URI",
  async () => {
    const context = new MCPContext({
      allowGithubContext: true,
    });

    await context.loadContext(GITHUB_URI, baseOptions);

    try {
      expect(context.tools.length).toBe(1);
      expect(context.resources.length).toBe(2);
      expect(context.prompts.length).toBe(2);

      const result = await context.executeTool(
        "greeting_tool",
        { name: "DirectLoad" },
        baseOptions,
      );

      expect(result).toBeTruthy();
      expect((result as Record<string, unknown>).greeting).toBe(
        "Hello, DirectLoad! Welcome to the example MCPBay context.",
      );
    } finally {
      context.dispose();
    }
  },
  GITHUB_PERMISSIONS,
);

test(
  "GitHub context - MCPContext.loadContext rejects when allowGithubContext is false",
  async () => {
    const context = new MCPContext({
      allowGithubContext: false,
    });

    await expect(
      context.loadContext(GITHUB_URI, baseOptions),
    ).rejects.toThrow("Github context is not allowed");
  },
  DENO_PERMISSIONS,
);

test(
  "GitHub context - loadContextFromGitHub with destinyDir stores files in the specified directory",
  async () => {
    const destinyDir = makeTempDirSync();

    try {
      const context = await loadContextFromGitHub({
        source: GITHUB_URI,
        options: baseOptions,
        destinyDir,
      });

      try {
        expect(context.tools.length).toBe(1);
        expect(context.resources.length).toBe(2);
        expect(context.prompts.length).toBe(2);

        expect(exists(join(destinyDir, "context.json"))).toBeTruthy();
        expect(exists(join(destinyDir, "deno.json"))).toBeTruthy();
        expect(exists(join(destinyDir, "tools"), true)).toBeTruthy();
        expect(exists(join(destinyDir, "resources"), true)).toBeTruthy();
        expect(exists(join(destinyDir, "prompts"), true)).toBeTruthy();

        expect(exists(join(destinyDir, "tools", "hello.ts"))).toBeTruthy();
        expect(exists(join(destinyDir, "resources", "README.md"))).toBeTruthy();
        expect(exists(join(destinyDir, "resources", "CONCEPT.ts")))
          .toBeTruthy();
        expect(exists(join(destinyDir, "prompts", "greet-user.md")))
          .toBeTruthy();
        expect(exists(join(destinyDir, "prompts", "generate-report.md")))
          .toBeTruthy();

        const contextJson = JSON.parse(
          readTextFileSync(join(destinyDir, "context.json")),
        );
        expect(contextJson.name).toBe("example_context");

        const result = await context.executeTool(
          "greeting_tool",
          { name: "DestinyUser" },
          baseOptions,
        );

        expect(result).toBeTruthy();
        expect((result as Record<string, unknown>).greeting).toBe(
          "Hello, DestinyUser! Welcome to the example MCPBay context.",
        );
      } finally {
        context.dispose();
      }
    } finally {
      removeSync(destinyDir);
    }
  },
  GITHUB_PERMISSIONS,
);

test(
  "GitHub context - loadContextFromGitHub passes token via arguments",
  async () => {
    const existingToken = envGet("GITHUB_TOKEN");
    const testToken = existingToken || "ghp_test_token_placeholder";

    const context = await loadContextFromGitHub({
      source: GITHUB_URI,
      options: baseOptions,
      token: testToken,
    });

    try {
      expect(context.tools.length).toBe(1);
      expect(context.resources.length).toBe(2);
      expect(context.prompts.length).toBe(2);
    } finally {
      context.dispose();
    }
  },
  GITHUB_PERMISSIONS,
);

test(
  "GitHub context - MCPContext.loadContext passes githubToken via options",
  async () => {
    const existingToken = envGet("GITHUB_TOKEN");
    const testToken = existingToken || "ghp_test_token_placeholder";
    const context = new MCPContext({
      allowGithubContext: true,
      githubToken: testToken,
    });

    await context.loadContext(GITHUB_URI, baseOptions);

    try {
      expect(context.tools.length).toBe(1);
      expect(context.resources.length).toBe(2);
      expect(context.prompts.length).toBe(2);
    } finally {
      context.dispose();
    }
  },
  GITHUB_PERMISSIONS,
);

test(
  "GitHub context - loadContextFromGitHub uses token from IGitHubContextSource",
  async () => {
    const existingToken = envGet("GITHUB_TOKEN");

    const source: IGitHubContextSource = {
      owner: "mcpbay",
      repo: "contexts-manager",
      branch: "main",
      path: "tests/contexts/example-context",
      token: existingToken || "ghp_test_token_placeholder",
    };

    const context = await loadContextFromGitHub({
      source,
      options: baseOptions,
    });

    try {
      expect(context.tools.length).toBe(1);
      expect(context.resources.length).toBe(2);
    } finally {
      context.dispose();
    }
  },
  GITHUB_PERMISSIONS,
);

test(
  "GitHub context - token parameter takes precedence over source.token",
  async () => {
    const existingToken = envGet("GITHUB_TOKEN");

    const source: IGitHubContextSource = {
      owner: "mcpbay",
      repo: "contexts-manager",
      branch: "main",
      path: "tests/contexts/example-context",
      token: "should_be_overridden",
    };

    const context = await loadContextFromGitHub({
      source,
      options: baseOptions,
      token: existingToken || "ghp_test_token_placeholder",
    });

    try {
      expect(context.tools.length).toBe(1);
      expect(context.resources.length).toBe(2);
    } finally {
      context.dispose();
    }
  },
  GITHUB_PERMISSIONS,
);

test(
  "GitHub context - GITHUB_TOKEN env var is used when no token is passed",
  async () => {
    const previousToken = envGet("GITHUB_TOKEN");

    try {
      envSet("GITHUB_TOKEN", previousToken || "ghp_env_token_placeholder");

      const context = await loadContextFromGitHub({
        source: GITHUB_URI,
        options: baseOptions,
      });

      try {
        expect(context.tools.length).toBe(1);
        expect(context.resources.length).toBe(2);
        expect(context.prompts.length).toBe(2);
      } finally {
        context.dispose();
      }
    } finally {
      if (previousToken) {
        envSet("GITHUB_TOKEN", previousToken);
      }
    }
  },
  GITHUB_PERMISSIONS,
);
