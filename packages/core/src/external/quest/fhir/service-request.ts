import {
  CodeableConcept,
  Coding,
  Identifier,
  Patient,
  Practitioner,
  Reference,
  ServiceRequest,
  Specimen,
  Location,
} from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { CPT_URL } from "@metriport/shared/medical";
import { SNOMED_LABORATORY_PROCEDURE_CODE } from "./constant";
import { ResponseDetail } from "../schema/response";
import { getPractitionerReference } from "./practitioner";
import { getQuestDataSourceExtension } from "./shared";
import { getPatientReference } from "./patient";
import { getServiceRequestCategory } from "../../fhir/resources/service-request";
import { getSpecimenReference } from "./specimen";
import { getLocationReference } from "./location";

export function getServiceRequest(
  detail: ResponseDetail,
  {
    patient,
    requestingPractitioner,
    location,
  }: { patient: Patient; requestingPractitioner: Practitioner; location: Location }
): ServiceRequest {
  const identifier = getServiceRequestIdentifier(detail);
  const subject = getPatientReference(patient);
  const requester = getPractitionerReference(requestingPractitioner);
  const code = getServiceRequestCoding(detail);
  const category = [getServiceRequestCategory("Laboratory procedure")];
  const extension = [getQuestDataSourceExtension()];
  const locationReference = [getLocationReference(location)];

  return {
    resourceType: "ServiceRequest",
    id: uuidv7(),
    status: "completed",
    intent: "original-order",
    subject,
    ...(code ? { code } : {}),
    category,
    ...(identifier ? { identifier } : {}),
    requester,
    locationReference,
    extension,
  };
}

export function addSpecimenToServiceRequest(
  serviceRequest: ServiceRequest,
  specimen: Specimen
): ServiceRequest {
  serviceRequest.specimen = [getSpecimenReference(specimen)];
  return serviceRequest;
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
  const text = detail.profileName ?? detail.orderName;

  if (detail.cptCode) {
    coding.push({
      system: CPT_URL,
      code: detail.cptCode,
    });
  }
  // Push a standard SNOMED
  coding.push(SNOMED_LABORATORY_PROCEDURE_CODE);

  return {
    ...(text ? { text } : {}),
    coding,
  };
}
