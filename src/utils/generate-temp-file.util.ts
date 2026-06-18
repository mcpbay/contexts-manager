import { makeTempFileSync, writeTextFileSync } from "./fs.util.ts";

export function generateTempFile(content: string, dirPath?: string, ext = "ts") {
  const tempFilePath = makeTempFileSync(ext, dirPath);

  writeTextFileSync(tempFilePath, content);

  return tempFilePath;
}
