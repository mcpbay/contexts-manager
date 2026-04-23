import { basename, dirname, extname } from "@std/path";
import { resolvePath } from "./resolve-path.util.ts";

/**
 * Interface that describes the relevant path data.
 */
export interface IFilePathData {
  /**
   * The full name of the file, including its extension.
   * Example: "document.pdf"
   */
  fullName: string;
  /**
   * The extension of the file, including the dot.
   * Example: ".pdf"
   */
  extension: string;
  /**
   * The name of the file without its extension.
   * Example: "document"
   */
  nameWithoutExtension: string;
  /**
   * The directory path where the file is located.
   */
  isolatedPath: string;
  /**
   * The absolute path of the file.
   */
  fullPath: string;
}

/**
 * Utility that extracts relevant path data from a given path.
 * 
 * @param path - The path to extract data from.
 * @returns An object containing the extracted path data.
 */
export function extractFilePathData(path: string) {
  const fullPath = resolvePath(path);
  const isolatedPath = dirname(fullPath);
  const fullName = basename(fullPath);
  const extension = extname(fullPath);
  const nameWithoutExtension = basename(fullPath, extension);

  const result: IFilePathData = {
    fullName,
    extension,
    nameWithoutExtension,
    isolatedPath,
    fullPath,
  };

  return result;
}
