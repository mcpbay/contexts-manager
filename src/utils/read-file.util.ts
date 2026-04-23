/**
 * Reads a text file and returns its content.
 *
 * @param filePath The path of the file to read.
 * @returns The content of the file.
 */
export async function readFile(filePath: string) {
  const fileContent = await Deno.readTextFile(filePath);
  return fileContent;
}
