import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import {
  CodeableConcept,
  Coding,
  DiagnosticReport,
  Identifier,
  Observation,
  Patient,
  Specimen,
} from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { getPatientReference } from "./patient";
import { getSpecimenReference } from "./specimen";
import { getServiceRequestCoding } from "./service-request";
import { getQuestDataSourceExtension } from "./shared";
import { getObservationReference } from "./observation";

export function getDiagnosticReport(
  detail: ResponseDetail,
  {
    patient,
    specimen,
    observation,
  }: { patient: Patient; specimen?: Specimen | undefined; observation?: Observation | undefined }
): DiagnosticReport {
  const effectiveDateTime = getEffectiveDateTime(detail);
  const code = getServiceRequestCoding(detail);
  const subject = getPatientReference(patient);
  const identifier = getIdentifier(detail);
  const result = observation ? [getObservationReference(observation)] : undefined;
  const specimenReference = specimen ? [getSpecimenReference(specimen)] : undefined;
  const category = getDiagnosticReportCategory(detail);
  const extension = [getQuestDataSourceExtension()];
  return {
    resourceType: "DiagnosticReport",
    id: uuidv7(),
    status: "final",
    effectiveDateTime,
    identifier,
    subject,
    ...(code ? { code } : {}),
    ...(result ? { result } : {}),
    ...(specimenReference ? { specimen: specimenReference } : {}),
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

function getEffectiveDateTime(detail: ResponseDetail): string {
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
