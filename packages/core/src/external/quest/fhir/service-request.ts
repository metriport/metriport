import {
  CodeableConcept,
  Coding,
  Identifier,
  Practitioner,
  ServiceRequest,
} from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { ResponseDetail } from "../schema/response";
import { getPractitionerReference } from "./practitioner";

export function getServiceRequest(
  detail: ResponseDetail,
  { requestingPractitioner }: { requestingPractitioner: Practitioner }
): ServiceRequest {
  const identifier = getServiceRequestIdentifier(detail);
  const requester = getPractitionerReference(requestingPractitioner);
  const code = getServiceRequestCoding(detail);
  return {
    resourceType: "ServiceRequest",
    id: uuidv7(),
    ...(code ? { code } : {}),
    ...(identifier ? { identifier } : {}),
    requester,
  };
}

function getServiceRequestIdentifier(detail: ResponseDetail): Identifier[] | undefined {
  if (!detail.requisitionNumber) return undefined;
  return [
    {
      system: "http://questdiagnostics.com/requisition-number",
      value: detail.requisitionNumber,
    },
  ];
}

function getServiceRequestCoding(detail: ResponseDetail): CodeableConcept | undefined {
  const coding: Coding[] = [];
  const text = detail.orderName ?? detail.profileName;

  if (detail.localProfileCode) {
    coding.push({
      system: "http://questdiagnostics.com/local-profile-code",
      code: detail.localProfileCode,
    });
  }
  if (detail.standardProfileCode) {
    coding.push({
      system: "http://questdiagnostics.com/standard-profile-code",
      code: detail.standardProfileCode,
    });
  }
  if (detail.localOrderCode) {
    coding.push({
      system: "http://questdiagnostics.com/local-order-code",
      code: detail.localOrderCode,
    });
  }
  if (detail.standardOrderCode) {
    coding.push({
      system: "http://questdiagnostics.com/standard-order-code",
      code: detail.standardOrderCode,
    });
  }

  return {
    ...(text ? { text } : {}),
    coding,
  };
}
