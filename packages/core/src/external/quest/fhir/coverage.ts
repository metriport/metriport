import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { Coverage, Identifier, Organization } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { getOrganizationReference } from "./organization";

export function getCoverage(
  detail: ResponseDetail,
  { insuranceOrganization }: { insuranceOrganization?: Organization }
): Coverage {
  const identifier = getCoverageIdentifier(detail);
  const payor = insuranceOrganization
    ? [getOrganizationReference(insuranceOrganization)]
    : undefined;

  return {
    resourceType: "Coverage",
    id: uuidv7(),
    ...(identifier ? { identifier } : {}),
    ...(payor ? { payor } : {}),
  };
}

function getCoverageIdentifier(detail: ResponseDetail): Identifier[] | undefined {
  if (!detail.patientId) return undefined;
  return [
    {
      system: "https://metriport.com/patient-id",
      value: detail.patientId,
    },
  ];
}
