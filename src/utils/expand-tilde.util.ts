import { envGet } from "./fs.util.ts";

export function expandTilde(path: string) {
  const hasTildePrefix = path.startsWith("~");

  if (!hasTildePrefix) {
    return path;
  }

  const home = envGet("HOME") ?? envGet("USERPROFILE");

  if (!home) {
    return null;
  }

  const isTildeOnly = path === "~";

  if (isTildeOnly) {
    return home;
  }

  const hasTildeSlashPrefix = path.startsWith("~/") || path.startsWith("~\\");

  if (hasTildeSlashPrefix) {
    return home + path.slice(1);
  }

  return path;
}
