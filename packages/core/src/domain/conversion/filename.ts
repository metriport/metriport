export function buildDocumentNameForPartialConversions(fileName: string, index: number): string {
  const paddedIndex = index.toString().padStart(3, "0");
  return `${fileName}_part_${paddedIndex}.xml`;
}

export function buildDocumentNameForFromConverter(fileName: string): string {
  return `${fileName}.from_converter.json`;
}

export function buildDocumentNameForPreConversion(fileName: string): string {
  return `${fileName}.pre_conversion.xml`;
}

export function buildDocumentNameForCleanConversion(fileName: string): string {
  return `${fileName}.clean.xml`;
}

export function buildDocumentNameForNormalizedConversion(fileName: string): string {
  return `${fileName}_normalized.json`;
}

export function buildDocumentNameForConversionResult(fileName: string): string {
  return `${fileName}.json`;
}
