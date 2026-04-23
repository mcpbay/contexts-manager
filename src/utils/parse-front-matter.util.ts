import { parse } from "@std/yaml";
import { readFile } from "./read-file.util.ts";

/**
 * Interface that describes the result of parsing front matter.
 */
export interface IFrontMatterResult<T = Record<string, unknown>> {
  /**
   * The parsed data from the YAML front matter.
   */
  data: T;
  /**
   * The remaining content of the file after the front matter.
   */
  content: string;
}

/**
 * Utility that extracts and parses YAML front matter from a string.
 *
 * It identifies content between '---' delimiters at the beginning of the string.
 *
 * @param filePath - The file path of the content file to parse.
 * @returns An object containing the parsed YAML data and the remaining content.
 */
export async function parseFrontMatter<T = Record<string, unknown>>(
  filePath: string,
) {
  const content = await readFile(filePath);
  const frontMatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
  const match = content.match(frontMatterRegex);
  const hasFrontMatter = match !== null;

  if (hasFrontMatter) {
    const yamlContent = match[1];
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
