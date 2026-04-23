// Thanks Deepseek!
export function expandTilde(path: string) {
  if (!path.startsWith("~")) {
    return path;
  }

  const home = Deno.env.get("HOME") ??
    Deno.env.get("USERPROFILE");

  if (!home) {
    return null;
  }

  if (path === "~") {
    return home;
  }

  if (path.startsWith("~/") || path.startsWith("~\\")) {
    return home + path.slice(1);
  }

  return path;
}
