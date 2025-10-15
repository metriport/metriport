import { ParseUnstructuredDataFromBundleInput, UnstructuredDataItem } from "../../types";

/**
 * Parses unstructured data from a FHIR bundle by extracting and decoding
 * base64-encoded data from presentedForm fields.
 */
export function parseUnstructuredDataFromBundle({
  documentId,
  bundle,
}: ParseUnstructuredDataFromBundleInput): UnstructuredDataItem[] {
  const results: UnstructuredDataItem[] = [];

  if (!bundle.entry) {
    return results;
  }

  for (const entry of bundle.entry) {
    const resource = entry.resource;
    if (!resource) continue;

    const resourceId = resource.id;
    if (!resourceId) continue;

    // Check if resource is Encounter or DiagnosticReport, these are the only types that have presentedForm
    if (resource.resourceType !== "Encounter" && resource.resourceType !== "DiagnosticReport")
      continue;

    const presentedForm = (resource as { presentedForm?: Array<{ data?: string }> }).presentedForm;
    if (!presentedForm) continue;

    for (const form of presentedForm) {
      if (form.data) {
        const decoded = Buffer.from(form.data, "base64").toString("utf-8");
        results.push({ documentId, resourceId, unstructuredData: decoded });
      }
    }
  }

  return results;
}
