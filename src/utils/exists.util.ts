import { resolvePath } from "./resolve-path.util.ts";
import { statSync } from "./fs.util.ts";

export function exists(path: string, isDir = false) {
  try {
    const resolvedPath = resolvePath(path);
    const stat = statSync(resolvedPath);

    return stat.isDirectory() === isDir;
  } catch {
    return false;
  }
}
