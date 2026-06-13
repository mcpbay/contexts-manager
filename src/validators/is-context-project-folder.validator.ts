import { exists } from "../utils/exists.util.ts";

export function isContextProjectFolder(path: string): boolean {
  return exists(path, true)
    && exists(`${path}/prompts`, true)
    && exists(`${path}/resources`, true)
    && exists(`${path}/tools`, true)
    && exists(`${path}/context.json`);
}