export function createDataParams(data: { [key: string]: string }): string {
  return Object.entries(data)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}
