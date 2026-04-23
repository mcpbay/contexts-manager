import { resolvePath } from "./resolve-path.util.ts";

export function readTextFile(path: string) {
  const systemPath = resolvePath(path);

  return Deno.readTextFileSync(systemPath);
}
