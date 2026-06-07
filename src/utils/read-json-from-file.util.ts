import { readTextFile } from "./read-text-file.util.ts";

export function readJsonFromFile<T>(path: string) {
  const textFileContent = readTextFile(path);
  const parsedContent = JSON.parse(textFileContent) as T;

  return parsedContent;
}
