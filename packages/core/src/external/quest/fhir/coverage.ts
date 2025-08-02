import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { Coverage, Organization, Patient } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { getPatientReference } from "./patient";
import { getOrganizationReference } from "./organization";

export function getCoverage(
  detail: ResponseDetail,
  { patient, insuranceOrganization }: { patient: Patient; insuranceOrganization?: Organization }
): Coverage | undefined {
  const beneficiary = getPatientReference(patient);
  const payor = insuranceOrganization
    ? [getOrganizationReference(insuranceOrganization)]
    : undefined;

  if (!beneficiary || !payor) return undefined;

  detail.patientId;

  return {
    resourceType: "Coverage",
    id: uuidv7(),
    beneficiary,
    ...(payor ? { payor } : {}),
  };
}
