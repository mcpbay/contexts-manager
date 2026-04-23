import { readTextFile } from "./read-text-file.util.ts";

export function readJsonFromFile<T>(path: string): T {
  const textFileContent = readTextFile(path);
  return JSON.parse(textFileContent) as T;
}
