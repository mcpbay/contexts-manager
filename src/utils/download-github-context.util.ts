import { dirname, join } from "@std/path";
import {
  envGet,
  makeTempDirSync,
  mkdirSync,
  removeSync,
  writeTextFileSync,
} from "./fs.util.ts";

export interface IGitHubContextSource {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
  token?: string;
}

interface IGitHubContentItem {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
}

function getToken(token?: string): string | undefined {
  return token ?? envGet("GITHUB_TOKEN");
}

function buildApiHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "mcpbay-contexts-manager",
  };

  const resolvedToken = getToken(token);

  if (resolvedToken) {
    headers.Authorization = `Bearer ${resolvedToken}`;
  }

  return headers;
}

async function fetchGitHubContents(
  owner: string,
  repo: string,
  branch: string,
  itemPath: string,
  headers: Record<string, string>,
): Promise<IGitHubContentItem[]> {
  const apiPath = itemPath ? `contents/${itemPath}` : "contents";
  const url =
    `https://api.github.com/repos/${owner}/${repo}/${apiPath}?ref=${branch}`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(
      `GitHub API error ${response.status}: ${response.statusText}. URL: ${url}`,
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    return [data];
  }

  return data;
}

async function downloadDirectory(
  owner: string,
  repo: string,
  branch: string,
  dirPath: string,
  localBasePath: string,
  headers: Record<string, string>,
): Promise<void> {
  const items = await fetchGitHubContents(
    owner,
    repo,
    branch,
    dirPath,
    headers,
  );
  const promises = items.map(async (item) => {
    if (item.type === "dir") {
      const localDir = join(localBasePath, item.path);

      mkdirSync(localDir);

      await downloadDirectory(
        owner,
        repo,
        branch,
        item.path,
        localBasePath,
        headers,
      );
    } else if (item.type === "file" && item.download_url) {
      const response = await fetch(item.download_url);

      if (!response.ok) {
        throw new Error(
          `Failed to download ${item.download_url}: ${response.status}`,
        );
      }

      const content = await response.text();
      const localFile = join(localBasePath, item.path);

      mkdirSync(dirname(localFile));
      writeTextFileSync(localFile, content);
    }
  });

  await Promise.all(promises);
}

export async function downloadGitHubContext(
  source: IGitHubContextSource,
  destDir: string = makeTempDirSync(),
): Promise<string> {
  const { owner, repo, branch = "main", path: subPath = "" } = source;
  const headers = buildApiHeaders(source.token);

  try {
    await downloadDirectory(owner, repo, branch, subPath, destDir, headers);

    return destDir;
  } catch (error) {
    removeSync(destDir);
    throw error;
  }
}

export function parseGitHubURI(uri: string): IGitHubContextSource {
  const url = new URL(uri);
  const parts = url.pathname.replace(/^\/+/, "").split("/");

  if (parts.length < 2) {
    throw new Error(
      `Invalid GitHub URI: ${uri}. Expected format: github://owner/repo[/tree/branch][/subpath]`,
    );
  }

  const owner = parts[0]!;
  const repo = parts[1]!;
  let branch = "main";
  let path = "";

  const treeIndex = parts.indexOf("tree");

  if (treeIndex !== -1 && parts[treeIndex + 1]) {
    branch = parts[treeIndex + 1]!;
    path = parts.slice(treeIndex + 2).join("/");
  }

  return { owner, repo, branch, path };
}
