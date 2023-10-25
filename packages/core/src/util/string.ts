export function sizeInBytes(str: string) {
  return new Blob([str]).size;
}
