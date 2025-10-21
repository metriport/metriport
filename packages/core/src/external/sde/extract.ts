import { Bundle, BundleEntry, DiagnosticReport, Encounter, Resource } from "@medplum/fhirtypes";
import { buildBundle } from "../fhir/bundle/bundle";

interface ConversionBundleContext {
  documentId: string;
}

/**
 * Parses unstructured data from a FHIR bundle by extracting and decoding
 * base64-encoded data from presentedForm fields.
 */
export function extractFromConversionBundle({
  bundle,
  documentId,
}: {
  bundle: Bundle;
  documentId: string;
}): Bundle | undefined {
  if (!bundle.entry) {
    return undefined;
  }

  const extractedBundleEntries: BundleEntry[] = [];
  const context: ConversionBundleContext = { documentId };

  for (const entry of bundle.entry) {
    const resource = entry.resource;
    if (!resource) continue;
    const extractedFromResource = extractFromResource({ resource, ...context });
    if (extractedFromResource) {
      extractedBundleEntries.push(...extractedFromResource);
    }
  }

  if (extractedBundleEntries.length > 0) {
    return buildBundle({
      type: "collection",
      entries: extractedBundleEntries,
    });
  }

  return undefined;
}

export function extractFromResource({
  resource,
  ...context
}: { resource: Resource } & ConversionBundleContext): BundleEntry[] | undefined {
  const resourceType = resource.resourceType;
  switch (resourceType) {
    case "Encounter":
      return extractFromEncounter({ encounter: resource as Encounter, ...context });
    case "DiagnosticReport":
      return extractFromDiagnosticReport({
        diagnosticReport: resource as DiagnosticReport,
        ...context,
      });
    default:
      return undefined;
  }
}

export function extractFromEncounter({
  encounter,
}: { encounter: Encounter } & ConversionBundleContext): BundleEntry[] | undefined {
  const presentedForm = getPresentedForm(encounter);
  if (!presentedForm) return undefined;

  return [];
}

export function extractFromDiagnosticReport({
  diagnosticReport,
}: { diagnosticReport: DiagnosticReport } & ConversionBundleContext): BundleEntry[] | undefined {
  const presentedForm = getPresentedForm(diagnosticReport);
  if (!presentedForm) return undefined;

  return [];
}

export function getPresentedForm(resource: Resource): Array<{ data?: string }> | undefined {
  if (!("presentedForm" in resource)) return undefined;
  const presentedForm = resource.presentedForm;
  if (!Array.isArray(presentedForm)) return undefined;
  return presentedForm.filter(form => form.data);
}
