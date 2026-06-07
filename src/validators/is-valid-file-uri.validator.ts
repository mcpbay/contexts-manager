export function isValidFileURI(path: string) {
  const hasFileProtocolPrefix = path.startsWith("file://");

  if (!hasFileProtocolPrefix) {
    return false;
  }

  const url = new URL(path);

  return url.protocol === "file:";
}
