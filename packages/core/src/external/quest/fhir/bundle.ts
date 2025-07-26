import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { IncomingData } from "../schema/shared";
import { ResponseDetail } from "../schema/response";
import { getPatient } from "./patient";
import { getPractitioner } from "./practitioner";
import { getInsuranceOrganization } from "./organization";
import { getCoverage } from "./coverage";
import { getConditions } from "./condition";
import { getServiceRequest } from "./service-request";

export async function convertIncomingDataToFhirBundle(
  cxId: string,
  patientId: string,
  details: IncomingData<ResponseDetail>[]
): Promise<Bundle> {
  console.log(cxId, patientId);
  const entry = details.flatMap(getBundleEntries);
  return {
    resourceType: "Bundle",
    entry,
  };
}

function getBundleEntries({ data }: IncomingData<ResponseDetail>): BundleEntry[] {
  const patient = getPatient(data);
  const practitioner = getPractitioner(data);
  const serviceRequest = getServiceRequest(data, {
    requestingPractitioner: practitioner,
  });
  const insuranceOrganization = getInsuranceOrganization(data);
  const coverage = getCoverage(data, {
    insuranceOrganization,
  });
  const conditions = getConditions(data, {
    patient,
  });
  const resources: Resource[] = [
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
