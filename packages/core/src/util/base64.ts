export function base64ToBuffer(value: string): Buffer {
  return Buffer.from(value, "base64");
}

export function base64ToString(value: string): string {
  return base64ToBuffer(value).toString();
}

export function stringToBase64(value: string): string {
  return Buffer.from(value).toString("base64");
}
