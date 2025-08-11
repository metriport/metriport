import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import {
  CodeableConcept,
  Coding,
  DiagnosticReport,
  Identifier,
  Observation,
  Patient,
  Practitioner,
  ServiceRequest,
  Specimen,
} from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { getPatientReference } from "./patient";
import { getSpecimenReference } from "./specimen";
import { getServiceRequestCoding, getServiceRequestReference } from "./service-request";
import { getQuestDataSourceExtension } from "./shared";
import { getObservationReference } from "./observation";
import { getPractitionerReference } from "./practitioner";

export function getDiagnosticReport(
  detail: ResponseDetail,
  {
    patient,
    practitioner,
    specimen,
    observation,
    serviceRequest,
  }: {
    patient: Patient;
    practitioner: Practitioner;
    specimen?: Specimen | undefined;
    observation?: Observation | undefined;
    serviceRequest?: ServiceRequest | undefined;
  }
): DiagnosticReport {
  const effectiveDateTime = getDateOfService(detail);
  const issued = getDateOfService(detail);
  const code = getServiceRequestCoding(detail);
  const subject = getPatientReference(patient);
  const identifier = getIdentifier(detail);
  const result = observation ? [getObservationReference(observation)] : undefined;
  const specimenReference = specimen ? getSpecimenReference(specimen) : undefined;
  const basedOn = serviceRequest ? [getServiceRequestReference(serviceRequest)] : undefined;
  const category = getDiagnosticReportCategory(detail);
  const extension = [getQuestDataSourceExtension()];
  const performer = practitioner ? [getPractitionerReference(practitioner)] : undefined;
  return {
    resourceType: "DiagnosticReport",
    id: uuidv7(),
    status: "final",
    identifier,
    subject,
    ...(effectiveDateTime ? { effectiveDateTime } : {}),
    ...(issued ? { issued } : {}),
    ...(code ? { code } : {}),
    ...(result ? { result } : {}),
    ...(specimenReference ? { specimen: [specimenReference] } : {}),
    ...(basedOn ? { basedOn } : {}),
    ...(performer ? { performer } : {}),
    ...(category.length > 0 ? { category } : {}),
    extension,
  };
}

function getDiagnosticReportCategory(detail: ResponseDetail): CodeableConcept[] {
  const coding: Coding[] = [];
  if (detail.localProfileCode) {
    coding.push({
      system: "http://questdiagnostics.com/lpc",
      code: detail.localProfileCode,
      ...(detail.profileName ? { display: detail.profileName } : {}),
    });
  }
  if (detail.standardProfileCode) {
    coding.push({
      system: "http://questdiagnostics.com/spc",
      code: detail.standardProfileCode,
      ...(detail.profileName ? { display: detail.profileName } : {}),
    });
  }
  return [{ coding }];
}

function getDateOfService(detail: ResponseDetail): string | undefined {
  if (!detail.dateOfService) return undefined;
  return detail.dateOfService.toISOString();
}

function getIdentifier(detail: ResponseDetail): Identifier[] {
  const identifier: Identifier[] = [
    {
      system: "quest-accession",
      value: detail.accessionNumber,
    },
  ];
  if (detail.requisitionNumber) {
    identifier.push({
      system: "quest-requisition",
      value: detail.requisitionNumber,
    });
  }
  return identifier;
}
