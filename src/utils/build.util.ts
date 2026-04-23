export type IBuildElement = IBuildFolderElement | IBuildFileElement;

export interface IBuildFileElement {
  type: 'file';
  name: string;
  extension: string;
  content: string | object | Uint8Array;
}

export interface IBuildFolderElement {
  type: 'folder';
  name: string;
  files: IBuildElement[];
}


export function build(destPath: string, elements: IBuildElement[]) {
  for (const element of elements) {
    switch (element.type) {
      case 'file':
        Deno.writeFileSync(`${destPath}/${element.name}.${element.extension}`, toUint8Array(element.content));
        break;
      case 'folder': {
        const folderPath = `${destPath}/${element.name}`;
        try {
          Deno.mkdirSync(folderPath, { recursive: true });
        } catch {
          // Folder might already exist
        }
        build(folderPath, element.files);
        break;
      }
    }
  }
}

function toUint8Array(text: string | object | Uint8Array) {
  if (typeof text === 'string') {
    return new TextEncoder().encode(text);
  }

  if (text instanceof Uint8Array) {
    return text;
  }

  return toUint8Array(JSON.stringify(text, null, 2));
}