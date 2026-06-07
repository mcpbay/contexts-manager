import { fromFileUrl, isAbsolute, join } from "@std/path";
import { isValidFileURI } from "../validators/is-valid-file-uri.validator.ts";
import { cwd } from "./fs.util.ts";

export function resolvePath(path: string | URL, basePath?: string) {
  const isPathUrl = path instanceof URL;

  if (isPathUrl) {
    const hasFileProtocol = path.protocol === "file:";

    if (hasFileProtocol) {
      return fromFileUrl(path);
    }

    throw new Error(`Can't convert non-file URI to path: ${path.href}`);
  }

  const isValidUri = isValidFileURI(path);

  if (isValidUri) {
    const url = new URL(path);
    const hasFileProtocol = url.protocol === "file:";

    if (hasFileProtocol) {
      return fromFileUrl(url);
    }

    throw new Error(`Can't convert non-file URI to path: ${path}`);
  }

  const isAbsolutePath = isAbsolute(path);

  if (isAbsolutePath) {
    return path;
  }

  const base = basePath ?? cwd();

  return join(base, path);
}
