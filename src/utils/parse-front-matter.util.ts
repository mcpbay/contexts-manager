import { parse } from "@std/yaml";
import { readFile } from "./read-file.util.ts";

export interface IFrontMatterResult<T = Record<string, unknown>> {
  data: T;
  content: string;
}

export async function parseFrontMatter<T = Record<string, unknown>>(
  filePath: string,
): Promise<IFrontMatterResult<T>> {
  const content = await readFile(filePath);
  const frontMatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
  const match = content.match(frontMatterRegex);
  const hasFrontMatter = match !== null;

  if (hasFrontMatter) {
    const yamlContent = match[1]!;
    const data = parse(yamlContent) as T;
    const remainingContent = content.replace(match[0], "");
    const result: IFrontMatterResult<T> = {
      data,
      content: remainingContent,
    };

    return result;
  }

  const result: IFrontMatterResult<T> = {
    data: {} as T,
    content,
  };

  return result;
}
