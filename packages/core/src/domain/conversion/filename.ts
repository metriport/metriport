export function buildDocumentNameForPartialConversions(fileName: string, index: number): string {
  const paddedIndex = index.toString().padStart(3, "0");
  return `${fileName}_part_${paddedIndex}.xml`;
}
