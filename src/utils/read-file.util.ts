import { readTextFile } from "./fs.util.ts";

export async function readFile(filePath: string) {
  const fileContent = await readTextFile(filePath);

  return fileContent;
}
