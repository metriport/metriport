import {
  CodeableConcept,
  Coding,
  Identifier,
  Condition,
  Patient,
  Practitioner,
  Reference,
  ServiceRequest,
  Specimen,
  Coverage,
} from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { getCoverageReference } from "../../surescripts/fhir/coverage";
import { ResponseDetail } from "../schema/response";
import { getConditionReference } from "./condition";
import { getPatientReference } from "./patient";
import { getPractitionerReference } from "./practitioner";
import { getQuestDataSourceExtension } from "./shared";
import { getSpecimenReference } from "./specimen";
import { CPT_URL, LOINC_URL } from "../../../util/constants";

export function getServiceRequest(
  detail: ResponseDetail,
  { patient, requestingPractitioner }: { patient: Patient; requestingPractitioner: Practitioner }
): ServiceRequest {
  const identifier = getServiceRequestIdentifier(detail);
  const subject = getPatientReference(patient);
  const category = getServiceRequestCategory();
  const requester = getPractitionerReference(requestingPractitioner);
  const authoredOn = getAuthoredOn(detail);
  const occurrenceDateTime = getOccurrenceDateTime(detail);
  const code = getServiceRequestCoding(detail);
  const extension = [getQuestDataSourceExtension()];

  return {
    resourceType: "ServiceRequest",
    id: uuidv7(),
    status: "completed",
    intent: "order",
    subject,
    category,
    ...(code ? { code } : {}),
    ...(authoredOn ? { authoredOn } : {}),
    ...(occurrenceDateTime ? { occurrenceDateTime } : {}),
    ...(identifier ? { identifier } : {}),
    requester,
    extension,
  };
}

export function updateServiceRequest(
  serviceRequest: ServiceRequest,
  {
    conditions,
    specimen,
    coverage,
  }: {
    conditions: Condition[];
    specimen?: Specimen | undefined;
    coverage?: Coverage | undefined;
  }
) {
  if (conditions.length > 0) {
    serviceRequest.reasonReference = conditions.map(getConditionReference);
  }
  if (specimen) {
    serviceRequest.specimen = [getSpecimenReference(specimen)];
  }
  if (coverage) {
    serviceRequest.insurance = [getCoverageReference(coverage)];
  }
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

export function getAuthoredOn(detail: ResponseDetail): string | undefined {
  if (!detail.dateOfService) return undefined;
  return detail.dateOfService.toISOString();
}

export function getOccurrenceDateTime(detail: ResponseDetail): string | undefined {
  if (!detail.dateCollected) return undefined;
  return detail.dateCollected.toISOString();
}

export function getServiceRequestCategory(): CodeableConcept[] {
  return [
    {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: "108252007",
          display: "Laboratory procedure",
        },
      ],
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
  if (detail.loincCode) {
    coding.push({
      system: LOINC_URL,
      code: detail.loincCode,
    });
  }
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
