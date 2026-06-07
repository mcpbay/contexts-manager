import { basename, dirname, extname } from "@std/path";
import { resolvePath } from "./resolve-path.util.ts";

export interface IFilePathData {
  fullName: string;
  extension: string;
  nameWithoutExtension: string;
  isolatedPath: string;
  fullPath: string;
}

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
