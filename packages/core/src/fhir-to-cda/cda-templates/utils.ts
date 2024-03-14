export function withNullFlavorObject(value: string | undefined, key: string) {
  if (value === undefined) {
    return {};
  } else {
    return { [key]: value };
  }
}

export function withNullFlavor(value: string | undefined, key?: string) {
  if (value === undefined) {
    return { "@_nullFlavor": "UNK" };
  } else {
    return key ? { [key]: value } : value;
  }
}
