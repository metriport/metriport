import QueryString from "qs";

export function queryToSearchParams(query: QueryString.ParsedQs): URLSearchParams {
  if (!query) return new URLSearchParams();
  const searchParams = new URLSearchParams();
  for (const key in query) {
    const value = query[key];
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach(v => isString(v) && searchParams.append(key, v));
      continue;
    }
    if (typeof value !== "string") continue;
    searchParams.append(key, value as string);
  }
  return searchParams;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
