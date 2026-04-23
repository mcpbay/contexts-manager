export function isValidFileURI(path: string) {
  if (!path.startsWith("file://")) {
    return false;
  }

  const url = new URL(path);

  if (url.protocol !== "file:") {
    return false;
  }

  return true;
}
