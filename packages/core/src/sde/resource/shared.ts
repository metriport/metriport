import { DiagnosticReport, Resource } from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { getDiagnosticReportParams, createDiagnosticReportReference } from "./diagnostic-report";
import { createExtractedFromExtension } from "./extension";

export function createResource<T extends Resource>(resourceType: T["resourceType"]): T {
  return {
    resourceType,
    id: uuidv7(),
  } as T;
}

export function createDiagnosticReportResource<T extends Resource>(
  diagnosticReport: DiagnosticReport,
  resourceType: T["resourceType"]
): T {
  const params = getDiagnosticReportParams(diagnosticReport);
  if (!params) return createResource(resourceType);

  const diagnosticReportReference = createDiagnosticReportReference(diagnosticReport);

  return {
    resourceType,
    id: uuidv7(),
    subject: params.subject,
    performer: params.performer,
    effectiveDateTime: params.effectiveDateTime,
    meta: params.meta,
    extension: [params.docIdExtension, createExtractedFromExtension(diagnosticReportReference)],
  } as T;
}
