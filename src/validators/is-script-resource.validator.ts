export function isScriptResource(filePath: string) {
  const isTypeScriptFile = filePath.endsWith(".ts");

  return isTypeScriptFile;
}
