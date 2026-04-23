import { resolvePath } from "./resolve-path.util.ts";

export function exists(path: string, isDir = false): boolean {
  try {
    const stat = Deno.statSync(resolvePath(path));
    return stat.isDirectory === isDir;
  } catch (e) {
    return false;
  }
}
