import { resolvePath } from "./resolve-path.util.ts";
import { readDirSync } from "./fs.util.ts";

export interface IDirectoryContent {
  files: string[];
  folders: string[];
}

export function getDirectoryContent(path: string) {
  const resolvedPath = resolvePath(path);
  const files: string[] = [];
  const folders: string[] = [];

  for (const entry of readDirSync(resolvedPath)) {
    const { name, isFile, isDirectory } = entry;
    const isDirectoryEntry = isDirectory;

    switch (true) {
      case isFile:
        files.push(name);
        break;
      case isDirectoryEntry:
        folders.push(name);
        break;
      default:
        break;
    }
  }

  const result: IDirectoryContent = {
    files,
    folders,
  };

  return result;
}
