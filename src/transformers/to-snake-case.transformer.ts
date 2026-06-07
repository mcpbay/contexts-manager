export function toSnakeCase(str: string) {
  const withSeparators = str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase()
    .replace(/^_+|_+$/g, "");

  return withSeparators;
}
