import { basename } from "@std/path";
import { isValidFileURI } from "../validators/is-valid-file-uri.validator.ts";

export function getBasename(path: string) {
  if (isValidFileURI(path)) {
    return basename(new URL(path));
  }

  return basename(path);
}
