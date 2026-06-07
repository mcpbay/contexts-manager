import { resolvePath } from "./resolve-path.util.ts";
import { readTextFileSync } from "./fs.util.ts";

export function readTextFile(path: string) {
  const systemPath = resolvePath(path);

  return readTextFileSync(systemPath);
}
