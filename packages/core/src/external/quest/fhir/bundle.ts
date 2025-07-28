import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { IncomingData } from "../schema/shared";
import { ResponseDetail } from "../schema/response";
import { getPatient } from "./patient";
import { getPractitioner } from "./practitioner";
import { getInsuranceOrganization } from "./organization";
import { getCoverage } from "./coverage";
import { getConditions } from "./condition";
import { getServiceRequest } from "./service-request";
import { dangerouslyDeduplicateFhir } from "../../../fhir-deduplication/deduplicate-fhir";
import { hydrateFhir } from "../../fhir/hydration/hydrate-fhir";

export async function convertIncomingDataToFhirBundle(
  cxId: string,
  patientId: string,
  details: IncomingData<ResponseDetail>[]
): Promise<Bundle> {
  console.log(cxId, patientId);
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
  const serviceRequest = getServiceRequest(data, {
    requestingPractitioner: practitioner,
  });
  const insuranceOrganization = getInsuranceOrganization(data);
  const coverage = getCoverage(data, {
    patient,
    insuranceOrganization,
  });
  const conditions = getConditions(data, {
    patient,
  });
  const resources: Array<Resource | undefined> = [
    patient,
    practitioner,
    coverage,
    insuranceOrganization,
    serviceRequest,
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
