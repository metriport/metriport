import { DiagnosticReport, Encounter, Extension, Reference, Range } from "@medplum/fhirtypes";
import { RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { DATA_EXTRACTION_URL } from "./constants";
import { ComprehendContext } from "./types";

export function buildExtensionForEntity(
  entity: RxNormEntity,
  {
    originalText,
    diagnosticReportId,
    encounterId,
    extensionUrl,
    globalOffsetOfOriginalText,
  }: ComprehendContext
): Extension {
  const textRange = getTextRange(entity);
  const valueString = textRange ? originalText?.slice(textRange?.start, textRange?.end) : undefined;
  const globalOffset = globalOffsetOfOriginalText ?? 0;

  const valueReference: Reference<DiagnosticReport | Encounter> | undefined = encounterId
    ? buildEncounterReference(encounterId)
    : diagnosticReportId
    ? buildDiagnosticReportReference(diagnosticReportId)
    : undefined;

  const valueRange = textRange ? buildRangeOfOriginalText(textRange, globalOffset) : undefined;

  return {
    url: extensionUrl ?? DATA_EXTRACTION_URL,
    ...(valueString ? { valueString } : undefined),
    ...(valueReference ? { valueReference } : undefined),
    ...(valueRange ? { valueRange } : undefined),
  };
}

function buildDiagnosticReportReference(diagnosticReportId: string): Reference<DiagnosticReport> {
  return { reference: `DiagnosticReport/${diagnosticReportId}` };
}

function buildEncounterReference(encounterId: string): Reference<Encounter> {
  return { reference: `Encounter/${encounterId}` };
}

function getTextRange(entity: RxNormEntity): { start: number; end: number } | undefined {
  let start = entity.BeginOffset;
  let end = entity.EndOffset;
  if (start == null || end == null) return undefined;

  for (const attribute of entity.Attributes ?? []) {
    if (attribute.BeginOffset != null && (start == null || attribute.BeginOffset < start)) {
      start = attribute.BeginOffset;
    }
    if (attribute.EndOffset != null && (end == null || attribute.EndOffset > end)) {
      end = attribute.EndOffset;
    }
  }
  return { start, end };
}

function buildRangeOfOriginalText(
  textRange: { start: number; end: number },
  globalOffset = 0
): Range {
  return {
    low: { value: textRange.start + globalOffset },
    high: { value: textRange.end + globalOffset },
  };
}
