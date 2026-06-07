import { makeTempFileSync, writeTextFileSync } from "./fs.util.ts";

export function generateTempFile(content: string) {
  const tempFilePath = makeTempFileSync("ts");

  writeTextFileSync(tempFilePath, content);

  return tempFilePath;
}
