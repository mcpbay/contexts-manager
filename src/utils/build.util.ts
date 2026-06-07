import { writeFileSync, mkdirSync } from "./fs.util.ts";

export type IBuildElement = IBuildFolderElement | IBuildFileElement;

export interface IBuildFileElement {
  type: "file";
  name: string;
  extension: string;
  content: string | object | Uint8Array;
}

export interface IBuildFolderElement {
  type: "folder";
  name: string;
  files: IBuildElement[];
}

export function build(destPath: string, elements: IBuildElement[]) {
  for (const element of elements) {
    const isFileElement = element.type === "file";

    switch (true) {
      case isFileElement: {
        const filePath = `${destPath}/${element.name}.${element.extension}`;
        const fileContent = toUint8Array(element.content);

        writeFileSync(filePath, fileContent);
        break;
      }
      default: {
        const folderPath = `${destPath}/${element.name}`;

        try {
          mkdirSync(folderPath);
        } catch {
          // empty
        }
        build(folderPath, element.files);
        break;
      }
    }
  }
}

function toUint8Array(text: string | object | Uint8Array) {
  const isTextString = typeof text === "string";

  if (isTextString) {
    return new TextEncoder().encode(text);
  }

  const isUint8Array = text instanceof Uint8Array;

  if (isUint8Array) {
    return text;
  }

  return toUint8Array(JSON.stringify(text, null, 2));
}
