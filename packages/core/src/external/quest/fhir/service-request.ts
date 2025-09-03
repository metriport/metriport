import {
  CodeableConcept,
  Coding,
  Identifier,
  Practitioner,
  Reference,
  ServiceRequest,
} from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { CPT_URL } from "@metriport/shared/medical";
import { ResponseDetail } from "../schema/response";
import { getPractitionerReference } from "./practitioner";
import { getQuestDataSourceExtension } from "./shared";

export function getServiceRequest(
  detail: ResponseDetail,
  { requestingPractitioner }: { requestingPractitioner: Practitioner }
): ServiceRequest {
  const identifier = getServiceRequestIdentifier(detail);
  const requester = getPractitionerReference(requestingPractitioner);
  const code = getServiceRequestCoding(detail);
  const extension = [getQuestDataSourceExtension()];

  return {
    resourceType: "ServiceRequest",
    id: uuidv7(),
    status: "completed",
    intent: "original-order",
    ...(code ? { code } : {}),
    ...(identifier ? { identifier } : {}),
    requester,
    extension,
  };
}

export function getServiceRequestReference(
  serviceRequest: ServiceRequest
): Reference<ServiceRequest> {
  return {
    reference: `ServiceRequest/${serviceRequest.id}`,
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

  if (detail.cptCode) {
    coding.push({
      system: CPT_URL,
      code: detail.cptCode,
    });
  }

  return {
    ...(text ? { text } : {}),
    coding,
  };
}
