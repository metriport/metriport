import { Attachment, Bundle, DiagnosticReport, Encounter, Resource } from "@medplum/fhirtypes";
import { base64ToString } from "@metriport/shared/util";
import { ExtractionSource } from "./types";

/**
 * Prepares unstructured data extraction from a FHIR bundle by first extracting and decoding
 * base64-encoded text from sources like presentedForm of DiagnosticReport and Encounters.
 */
export function extractFromConversionBundle({
  bundle,
  documentId,
}: {
  bundle: Bundle;
  documentId: string;
}): ExtractionSource[] {
  if (!bundle.entry) {
    return [];
  }

  const extractionSources: ExtractionSource[] = [];

  for (const entry of bundle.entry) {
    const resource = entry.resource;
    if (!resource) continue;
    const extractedFromResource = extractFromResource({ resource, documentId });
    if (extractedFromResource) {
      extractionSources.push(...extractedFromResource);
    }
  }

  return extractionSources;
}

export function extractFromResource({
  resource,
  documentId,
}: {
  resource: Resource;
  documentId: string;
}): ExtractionSource[] | undefined {
  const resourceType = resource.resourceType;
  switch (resourceType) {
    case "Encounter":
      return extractFromEncounter({ encounter: resource as Encounter, documentId });
    case "DiagnosticReport":
      return extractFromDiagnosticReport({
        diagnosticReport: resource as DiagnosticReport,
        documentId,
      });
    default:
      return undefined;
  }
}

export function extractFromEncounter({
  encounter,
  documentId,
}: {
  encounter: Encounter;
  documentId: string;
}): ExtractionSource[] | undefined {
  const presentedForm = getPresentedForm(encounter);
  if (!presentedForm) return undefined;

  return presentedForm.map(form => ({
    documentId,
    resource: encounter,
    textContent: base64ToString(form.data ?? ""),
  }));
}

export function extractFromDiagnosticReport({
  diagnosticReport,
  documentId,
}: {
  diagnosticReport: DiagnosticReport;
  documentId: string;
}): ExtractionSource[] | undefined {
  const presentedForm = getPresentedForm(diagnosticReport);
  if (!presentedForm) return undefined;

  return presentedForm.map(form => ({
    documentId,
    resource: diagnosticReport,
    textContent: base64ToString(form.data ?? ""),
  }));
}

export function getPresentedForm(resource: Resource): Attachment[] | undefined {
  if (!("presentedForm" in resource)) return undefined;
  const presentedForm = resource.presentedForm;
  if (!Array.isArray(presentedForm)) return undefined;
  return presentedForm.filter(form => form.data);
}
