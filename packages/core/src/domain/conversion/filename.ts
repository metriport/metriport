export function buildDocumentNameForPartialConversions(fileName: string, index: number): string {
  const paddedIndex = index.toString().padStart(3, "0");
  return `${fileName}_part_${paddedIndex}.xml`;
}

type ConversionFhirPath = {
  cxId: string;
  patientId: string;
  requestId: string;
};

export function buildPathForConversionFhir({
  cxId,
  patientId,
  requestId,
}: ConversionFhirPath): string {
  return `conversion-fhir/cxid=${cxId}/patientid=${patientId}/requestid=${requestId}`;
}

export function buildKeyForConversionFhir({
  fileName,
  ...conversionFhirPathParams
}: ConversionFhirPath & { fileName: string }): string {
  return `${buildPathForConversionFhir(conversionFhirPathParams)}/${fileName}`;
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
