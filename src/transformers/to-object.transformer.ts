export function toObject<T>(text: string) {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
