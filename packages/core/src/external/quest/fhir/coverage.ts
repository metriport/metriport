import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { Coverage, Identifier, Organization, Patient } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { getPatientReference } from "./patient";
import { getOrganizationReference } from "./organization";
import { getQuestDataSourceExtension } from "./shared";

export function getCoverage(
  detail: ResponseDetail,
  { patient, insuranceOrganization }: { patient: Patient; insuranceOrganization?: Organization }
): Coverage | undefined {
  const identifier = getCoverageIdentifier(detail);
  const beneficiary = getPatientReference(patient);
  const subscriberId = getSubscriberId(detail);
  const payor = insuranceOrganization
    ? [getOrganizationReference(insuranceOrganization)]
    : undefined;
  const extension = [getQuestDataSourceExtension()];
  if (!beneficiary || !payor) return undefined;

  return {
    resourceType: "Coverage",
    id: uuidv7(),
    status: "active",
    beneficiary,
    ...(subscriberId ? { subscriberId } : {}),
    ...(identifier.length > 0 ? { identifier } : {}),
    ...(payor ? { payor } : {}),
    extension,
  };
}

export function getSubscriberId(detail: ResponseDetail): string | undefined {
  if (detail.medicaidId) {
    return detail.medicaidId;
  }
  if (detail.medicareId) {
    return detail.medicareId;
  }
  if (detail.questPatientId) {
    return detail.questPatientId;
  }
  return undefined;
}

export function getCoverageIdentifier(detail: ResponseDetail): Identifier[] {
  const identifier: Identifier[] = [];
  if (detail.medicaidId) {
    identifier.push({
      system: "http://hl7.org/fhir/sid/us-cms",
      value: detail.medicaidId,
    });
  }
  if (detail.medicareId) {
    identifier.push({
      system: "http://hl7.org/fhir/sid/us-cms",
      value: detail.medicareId,
    });
  }
  return identifier;
}
