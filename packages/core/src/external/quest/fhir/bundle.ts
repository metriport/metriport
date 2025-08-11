import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { IncomingData } from "../schema/shared";
import { ResponseDetail } from "../schema/response";
import { getPatient } from "./patient";
import { getPractitioner } from "./practitioner";
import { getInsuranceOrganization } from "./organization";
import { getCoverage } from "./coverage";
import { getConditions } from "./condition";
import { getServiceRequest, updateServiceRequest } from "./service-request";
import { getObservation } from "./observation";
import { getDiagnosticReport } from "./diagnostic-report";
import { dangerouslyDeduplicateFhir } from "../../../fhir-deduplication/deduplicate-fhir";
import { hydrateFhir } from "../../fhir/hydration/hydrate-fhir";
import { getSpecimen } from "./specimen";

export async function convertIncomingDataToFhirBundle(
  cxId: string,
  patientId: string,
  details: IncomingData<ResponseDetail>[]
): Promise<Bundle> {
  const entry = details.flatMap(getBundleEntries);
  const bundle: Bundle = {
    resourceType: "Bundle",
    entry,
  };
  dangerouslyDeduplicateFhir(bundle, cxId, patientId);
  await hydrateFhir(bundle, console.log);
  return bundle;
}

function getBundleEntries({ data }: IncomingData<ResponseDetail>): BundleEntry[] {
  const patient = getPatient(data);
  const practitioner = getPractitioner(data);
  const insuranceOrganization = getInsuranceOrganization(data);
  const observation = getObservation(data, {
    patient,
  });
  const serviceRequest = getServiceRequest(data, {
    patient,
    requestingPractitioner: practitioner,
  });
  const specimen = getSpecimen(data, {
    patient,
    practitioner,
    serviceRequest,
  });
  const diagnosticReport = getDiagnosticReport(data, {
    patient,
    specimen,
    observation,
  });
  const coverage = getCoverage(data, {
    patient,
    insuranceOrganization,
  });
  const conditions = getConditions(data, {
    patient,
  });
  // Add references to conditions and specimen if created
  updateServiceRequest(serviceRequest, {
    conditions,
    specimen,
    coverage,
  });
  const resources: Array<Resource | undefined> = [
    patient,
    practitioner,
    insuranceOrganization,
    observation,
    serviceRequest,
    specimen,
    diagnosticReport,
    coverage,
    ...conditions,
  ];

  return resources.flatMap(resource => {
    if (!resource || !resource.id) return [];
    return [
      {
        fullUrl: `urn:uuid:${resource.id}`,
        resource,
      },
    ];
  });
}
