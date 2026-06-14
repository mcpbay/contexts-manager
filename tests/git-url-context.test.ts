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
  isStandardGitUrl,
  parseGitUrl
} from "../src/utils/download-github-context.util.ts";
import { DENO_PERMISSIONS } from "./constants.ts";

const projectRoot = cwd();

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

test("isStandardGitUrl - Returns true for https://github.com/owner/repo", () => {
  expect(isStandardGitUrl("https://github.com/mcpbay/contexts-manager")).toBe(true);
});

test("isStandardGitUrl - Returns true for https://github.com/owner/repo.git", () => {
  expect(isStandardGitUrl("https://github.com/mcpbay/contexts-manager.git")).toBe(true);
});

test("isStandardGitUrl - Returns true for https://github.com/owner/repo/tree/branch", () => {
  expect(isStandardGitUrl("https://github.com/mcpbay/contexts-manager/tree/main")).toBe(true);
});

test("isStandardGitUrl - Returns true for https://github.com/owner/repo/tree/branch/subpath", () => {
  expect(isStandardGitUrl("https://github.com/mcpbay/contexts-manager/tree/main/tests/contexts/example-context")).toBe(true);
});

test("isStandardGitUrl - Returns true for git@github.com:owner/repo.git", () => {
  expect(isStandardGitUrl("git@github.com:mcpbay/contexts-manager.git")).toBe(true);
});

test("isStandardGitUrl - Returns true for git@github.com:owner/repo", () => {
  expect(isStandardGitUrl("git@github.com:mcpbay/contexts-manager")).toBe(true);
});

test("isStandardGitUrl - Returns false for github:// URI", () => {
  expect(isStandardGitUrl("github://mcpbay/contexts-manager")).toBe(false);
});

test("isStandardGitUrl - Returns false for local paths", () => {
  expect(isStandardGitUrl("./my-context")).toBe(false);
  expect(isStandardGitUrl("/absolute/path")).toBe(false);
});

test("parseGitUrl - Parses https://github.com/owner/repo", () => {
  const result = parseGitUrl("https://github.com/mcpbay/contexts-manager");

  expect(result.owner).toBe("mcpbay");
  expect(result.repo).toBe("contexts-manager");
  expect(result.branch).toBe("main");
  expect(result.path).toBe("");
});

test("parseGitUrl - Parses https://github.com/owner/repo.git", () => {
  const result = parseGitUrl("https://github.com/mcpbay/contexts-manager.git");

  expect(result.owner).toBe("mcpbay");
  expect(result.repo).toBe("contexts-manager");
  expect(result.branch).toBe("main");
  expect(result.path).toBe("");
});

test("parseGitUrl - Parses https://github.com/owner/repo with branch", () => {
  const result = parseGitUrl("https://github.com/mcpbay/contexts-manager/tree/develop");

  expect(result.owner).toBe("mcpbay");
  expect(result.repo).toBe("contexts-manager");
  expect(result.branch).toBe("develop");
  expect(result.path).toBe("");
});

test("parseGitUrl - Parses https://github.com/owner/repo with branch and subpath", () => {
  const result = parseGitUrl("https://github.com/mcpbay/contexts-manager/tree/main/tests/contexts/example-context");

  expect(result.owner).toBe("mcpbay");
  expect(result.repo).toBe("contexts-manager");
  expect(result.branch).toBe("main");
  expect(result.path).toBe("tests/contexts/example-context");
});

test("parseGitUrl - Parses https://github.com/owner/repo.git with branch and subpath", () => {
  const result = parseGitUrl("https://github.com/mcpbay/contexts-manager.git/tree/main/tests/contexts/example-context");

  expect(result.owner).toBe("mcpbay");
  expect(result.repo).toBe("contexts-manager");
  expect(result.branch).toBe("main");
  expect(result.path).toBe("tests/contexts/example-context");
});

test("parseGitUrl - Parses git@github.com:owner/repo.git", () => {
  const result = parseGitUrl("git@github.com:mcpbay/contexts-manager.git");

  expect(result.owner).toBe("mcpbay");
  expect(result.repo).toBe("contexts-manager");
  expect(result.branch).toBe("main");
  expect(result.path).toBe("");
});

test("parseGitUrl - Parses git@github.com:owner/repo", () => {
  const result = parseGitUrl("git@github.com:mcpbay/contexts-manager");

  expect(result.owner).toBe("mcpbay");
  expect(result.repo).toBe("contexts-manager");
  expect(result.branch).toBe("main");
  expect(result.path).toBe("");
});

test("parseGitUrl - Parses git@github.com:owner/repo with branch and subpath", () => {
  const result = parseGitUrl("git@github.com:mcpbay/contexts-manager/tree/main/tests/contexts/example-context");

  expect(result.owner).toBe("mcpbay");
  expect(result.repo).toBe("contexts-manager");
  expect(result.branch).toBe("main");
  expect(result.path).toBe("tests/contexts/example-context");
});

test("parseGitUrl - Throws for unsupported host", () => {
  expect(() => parseGitUrl("https://gitlab.com/owner/repo")).toThrow("Unsupported Git host");
});

test("parseGitUrl - Throws for invalid URL format", () => {
  expect(() => parseGitUrl("not-a-url")).toThrow("Invalid Git URL");
});

test(
  "Git URL context - Loads example context from https://github.com/...",
  async () => {
    const context = await loadContextFromGitHub({
      source: "https://github.com/mcpbay/contexts-manager/tree/main/tests/contexts/example-context",
      options: baseOptions,
    });

    try {
      expect(context.tools.length).toBe(1);
      expect(context.resources.length).toBe(2);
      expect(context.prompts.length).toBe(2);

      const tool = context.tools.find((t) => t.name === "greeting_tool");
      expect(tool).toBeTruthy();
      expect(tool!.description).toBe("Give me a greeting");
    } finally {
      context.dispose();
    }
  },
  GITHUB_PERMISSIONS,
);

test(
  "Git URL context - Loads example context from https://github.com/....git",
  async () => {
    const context = await loadContextFromGitHub({
      source: "https://github.com/mcpbay/contexts-manager.git/tree/main/tests/contexts/example-context",
      options: baseOptions,
    });

    try {
      expect(context.tools.length).toBe(1);
      expect(context.resources.length).toBe(2);

      const result = await context.executeTool(
        "greeting_tool",
        { name: "GitURLUser" },
        baseOptions,
      );

      expect(result).toBeTruthy();
      expect((result as Record<string, unknown>).greeting).toBe(
        "Hello, GitURLUser! Welcome to the example MCPBay context.",
      );
    } finally {
      context.dispose();
    }
  },
  GITHUB_PERMISSIONS,
);

test(
  "Git URL context - MCPContext.loadContext with https://github.com/... URL",
  async () => {
    const context = new MCPContext({
      allowGithubContext: true,
    });

    await context.loadContext(
      "https://github.com/mcpbay/contexts-manager/tree/main/tests/contexts/example-context",
      baseOptions,
    );

    try {
      expect(context.tools.length).toBe(1);
      expect(context.resources.length).toBe(2);
      expect(context.prompts.length).toBe(2);

      const result = await context.executeTool(
        "greeting_tool",
        { name: "HTTPSLoad" },
        baseOptions,
      );

      expect(result).toBeTruthy();
      expect((result as Record<string, unknown>).greeting).toBe(
        "Hello, HTTPSLoad! Welcome to the example MCPBay context.",
      );
    } finally {
      context.dispose();
    }
  },
  GITHUB_PERMISSIONS,
);

test(
  "Git URL context - MCPContext.loadContext with git@github.com:... URL",
  async () => {
    const context = new MCPContext({
      allowGithubContext: true,
    });

    await context.loadContext(
      "git@github.com:mcpbay/contexts-manager/tree/main/tests/contexts/example-context",
      baseOptions,
    );

    try {
      expect(context.tools.length).toBe(1);
      expect(context.resources.length).toBe(2);
      expect(context.prompts.length).toBe(2);

      const result = await context.executeTool(
        "greeting_tool",
        { name: "SSHLoad" },
        baseOptions,
      );

      expect(result).toBeTruthy();
      expect((result as Record<string, unknown>).greeting).toBe(
        "Hello, SSHLoad! Welcome to the example MCPBay context.",
      );
    } finally {
      context.dispose();
    }
  },
  GITHUB_PERMISSIONS,
);

test(
  "Git URL context - MCPContext.loadContext rejects when allowGithubContext is false (https://)",
  async () => {
    const context = new MCPContext({
      allowGithubContext: false,
    });

    await expect(
      context.loadContext(
        "https://github.com/mcpbay/contexts-manager/tree/main/tests/contexts/example-context",
        baseOptions,
      ),
    ).rejects.toThrow("Github context is not allowed");
  },
  DENO_PERMISSIONS,
);

test(
  "Git URL context - MCPContext.loadContext rejects when allowGithubContext is false (git@)",
  async () => {
    const context = new MCPContext({
      allowGithubContext: false,
    });

    await expect(
      context.loadContext(
        "git@github.com:mcpbay/contexts-manager/tree/main/tests/contexts/example-context",
        baseOptions,
      ),
    ).rejects.toThrow("Github context is not allowed");
  },
  DENO_PERMISSIONS,
);

test(
  "Git URL context - loadContextFromGitHub with destinyDir stores files (https://)",
  async () => {
    const destinyDir = makeTempDirSync();

    try {
      const context = await loadContextFromGitHub({
        source: "https://github.com/mcpbay/contexts-manager/tree/main/tests/contexts/example-context",
        options: baseOptions,
        destinyDir,
      });

      try {
        expect(context.tools.length).toBe(1);

        expect(exists(join(destinyDir, "context.json"))).toBeTruthy();
        expect(exists(join(destinyDir, "tools"), true)).toBeTruthy();
        expect(exists(join(destinyDir, "resources"), true)).toBeTruthy();

        const contextJson = JSON.parse(
          readTextFileSync(join(destinyDir, "context.json")),
        );
        expect(contextJson.name).toBe("example_context");
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
  "Git URL context - loads repo root and detects context/ subfolder (https://)",
  async () => {
    const context = new MCPContext({
      allowGithubContext: true,
    });

    await context.loadContext(
      "https://github.com/mcpbay/contexts-manager",
      baseOptions,
    );

    try {
      expect(context.tools.length).toBe(1);
      expect(context.resources.length).toBe(2);
      expect(context.prompts.length).toBe(1);
      expect(context.agents.length).toBeGreaterThan(0);

      const tool = context.tools.find((t) => t.name === "init_context");
      expect(tool).toBeTruthy();
    } finally {
      context.dispose();
    }
  },
  GITHUB_PERMISSIONS,
);

test(
  "Git URL context - loads repo root and detects context/ subfolder (git@)",
  async () => {
    const context = new MCPContext({
      allowGithubContext: true,
    });

    await context.loadContext(
      "git@github.com:mcpbay/contexts-manager",
      baseOptions,
    );

    try {
      expect(context.tools.length).toBe(1);
      expect(context.resources.length).toBe(2);
      expect(context.prompts.length).toBe(1);

      const tool = context.tools.find((t) => t.name === "init_context");
      expect(tool).toBeTruthy();
    } finally {
      context.dispose();
    }
  },
  GITHUB_PERMISSIONS,
);

test(
  "Git URL context - loads repo root and detects context/ subfolder (https:// with .git)",
  async () => {
    const context = new MCPContext({
      allowGithubContext: true,
    });

    await context.loadContext(
      "https://github.com/mcpbay/contexts-manager.git",
      baseOptions,
    );

    try {
      expect(context.tools.length).toBe(1);
      expect(context.resources.length).toBe(2);
      expect(context.prompts.length).toBe(1);

      const tool = context.tools.find((t) => t.name === "init_context");
      expect(tool).toBeTruthy();
    } finally {
      context.dispose();
    }
  },
  GITHUB_PERMISSIONS,
);

test(
  "Git URL context - passes githubToken via options (https://)",
  async () => {
    const existingToken = envGet("GITHUB_TOKEN");
    const testToken = existingToken || "ghp_test_token_placeholder";
    const context = new MCPContext({
      allowGithubContext: true,
      githubToken: testToken,
    });

    await context.loadContext(
      "https://github.com/mcpbay/contexts-manager/tree/main/tests/contexts/example-context",
      baseOptions,
    );

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
  "Git URL context - GITHUB_TOKEN env var is used (https://)",
  async () => {
    const previousToken = envGet("GITHUB_TOKEN");

    try {
      envSet("GITHUB_TOKEN", previousToken || "ghp_env_token_placeholder");

      const context = await loadContextFromGitHub({
        source: "https://github.com/mcpbay/contexts-manager/tree/main/tests/contexts/example-context",
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
