import { Coding } from "@medplum/fhirtypes";
import { FhirBundleSdk } from "@metriport/fhir-sdk";

interface DiagnosticReportSource {
  presentedForm: string[];
  observationCodes: Coding[];
}

/**
 * Retrieves all DiagnosticReport resources in the bundle, and creates a source object for
 * each resource that only contains the necessary information for data extraction.
 *
 * @param bundle
 * @returns
 */
export function findAllDiagnosticReportSources(bundle: FhirBundleSdk): DiagnosticReportSource[] {
  const diagnosticReports = bundle.getDiagnosticReports();
  const diagnosticReportSources: DiagnosticReportSource[] = [];

  for (const diagnosticReport of diagnosticReports) {
    // If there is no unstructured text in this diagnostic report
    if (!diagnosticReport.presentedForm) continue;

    const diagnosticReportSource: DiagnosticReportSource = {
      presentedForm: [],
      observationCodes: [],
    };

    // Push all observation codes to the source object
    const observations = diagnosticReport.getResults();
    for (const observation of observations) {
      if (observation.code?.coding) {
        diagnosticReportSource.observationCodes.push(...observation.code.coding);
      }
    }

    // Push all presented forms to the source object
    for (const presentedForm of diagnosticReport.presentedForm) {
      if (!presentedForm.data) continue;
      const text = Buffer.from(presentedForm.data, "base64").toString("utf-8");
      diagnosticReportSource.presentedForm.push(text);
    }
  }
  return diagnosticReportSources;
}
