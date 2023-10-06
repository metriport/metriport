export function base64ToString(value: string): string {
  return Buffer.from(value, "base64").toString();
}

export function stringToBase64(value: string): string {
  return Buffer.from(value).toString("base64");
}
