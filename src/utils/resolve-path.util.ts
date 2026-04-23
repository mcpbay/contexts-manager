import { fromFileUrl, isAbsolute, join } from "@std/path";
import { isValidFileURI } from "../validators/is-valid-file-uri.validator.ts";

export function resolvePath(path: string | URL, basePath?: string) {
  let result: string;

  if (path instanceof URL) {
    if (path.protocol === "file:") {
      result = fromFileUrl(path);
    } else {
      throw new Error(`Can't convert non-file URI to path: ${path.href}`);
    }
  } else {
    if (isValidFileURI(path)) {
      const url = new URL(path);

      if (url.protocol === "file:") {
        result = fromFileUrl(url);
      } else {
        throw new Error(`Can't convert non-file URI to path: ${path}`);
      }
    } else {
      if (isAbsolute(path)) {
        result = path;
      } else {
        const base = basePath ?? Deno.cwd();
        result = join(base, path);
      }
    }
  }

  return result;
}
