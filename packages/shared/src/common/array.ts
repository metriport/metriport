export function wrapInArray(element: unknown): unknown[] {
  if (Array.isArray(element)) return element;
  return [element];
}
