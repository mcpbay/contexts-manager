export function toObject<T>(text: string) {
  try {
    const parsedValue = JSON.parse(text) as T;

    return parsedValue;
  } catch {
    return null;
  }
}
