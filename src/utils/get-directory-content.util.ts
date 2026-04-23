import { resolvePath } from "./resolve-path.util.ts";

/**
 * Interface that describes the content of a directory.
 */
export interface IDirectoryContent {
  /**
   * List of file names found in the directory.
   */
  files: string[];
  /**
   * List of folder names found in the directory.
   */
  folders: string[];
}

/**
 * Utility that retrieves all files and folders within a given directory path.
 *
 * @param path - The directory path to read.
 * @returns An object containing arrays of files and folders.
 */
export function getDirectoryContent(path: string) {
  const resolvedPath = resolvePath(path);
  const files: string[] = [];
  const folders: string[] = [];

  for (const entry of Deno.readDirSync(resolvedPath)) {
    const { name, isFile, isDirectory } = entry;

    switch (true) {
      case isFile:
        files.push(name);
        break;
      case isDirectory:
        folders.push(name);
        break;
      default:
        // Skip other types like symlinks if not explicitly requested
        break;
    }
  }

  const result: IDirectoryContent = {
    files,
    folders,
  };

  return result;
}
