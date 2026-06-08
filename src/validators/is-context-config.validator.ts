import type { IContextConfig } from "../interfaces/mod.ts";
import { isPlainObject, isString } from "@online/is";

export function isContextConfig(value: unknown): value is IContextConfig {
  const isPlainObjectValue = isPlainObject(value);
  const valueRecord = value as Record<string, unknown>;
  const isNameString = "name" in valueRecord && isString(valueRecord["name"]);
  const isVersionString = "version" in valueRecord &&
    isString(valueRecord["version"]);
  const isDescriptionString = "description" in valueRecord &&
    isString(valueRecord["description"]);
  const isAuthorString = "author" in valueRecord &&
    isString(valueRecord["author"]);
  const isTagsArray = "tags" in valueRecord &&
    Array.isArray(valueRecord["tags"]);

  return isPlainObjectValue && isNameString && isVersionString &&
    isDescriptionString && isAuthorString && isTagsArray;
}
