import { makeTempFileSync } from "./fs.util.ts";

export function generateTempFile(content: string, dirPath?: string, ext = "ts") {
  const tempFilePath = makeTempFileSync(ext, { dirPath, content });

  return tempFilePath;
}
