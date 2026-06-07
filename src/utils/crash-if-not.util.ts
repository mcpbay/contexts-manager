export function crashIfNot(
  condition: unknown,
  message: string,
): asserts condition {
  const isInvalidCondition = !condition;

  if (isInvalidCondition) {
    throw new Error(message);
  }
}
