import { DiagnosticReport, Encounter, Extension, Reference } from "@medplum/fhirtypes";
import { RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { DATA_EXTRACTION_URL } from "./constants";
import { ComprehendContext } from "./types";

export function buildComprehendExtensionForEntity(
  entity: RxNormEntity,
  { originalText, diagnosticReportId, encounterId }: ComprehendContext
): Extension {
  const textRange = getTextRange(entity);
  const valueString = textRange ? originalText?.slice(textRange?.start, textRange?.end) : undefined;

  const valueReference: Reference<DiagnosticReport | Encounter> | undefined = encounterId
    ? buildEncounterReference(encounterId)
    : diagnosticReportId
    ? buildDiagnosticReportReference(diagnosticReportId)
    : undefined;

  return {
    url: DATA_EXTRACTION_URL,
    ...(valueString ? { valueString } : undefined),
    ...(valueReference ? { valueReference } : undefined),
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
