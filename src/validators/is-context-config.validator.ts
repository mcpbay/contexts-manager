import type { IContextConfig } from "../interfaces/mod.ts";
import { isPlainObject, isString } from "@online/is";

export function isContextConfig(value: unknown): value is IContextConfig {
  return isPlainObject(value)
    && "name" in value && isString(value.name)
    && "version" in value && isString(value.version)
    && "description" in value && isString(value.description)
    && "author" in value && isString(value.author)
    && "tags" in value && Array.isArray(value.tags);
}