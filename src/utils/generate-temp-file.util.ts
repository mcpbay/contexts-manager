import { makeTempFileSync, writeTextFileSync } from "./fs.util.ts";

export function generateTempFile(content: string, dirPath?: string) {
  const tempFilePath = makeTempFileSync("ts", dirPath);

  writeTextFileSync(tempFilePath, content);

  return tempFilePath;
}
