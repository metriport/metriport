import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import {
  CodeableConcept,
  Coding,
  DiagnosticReport,
  Identifier,
  Patient,
  Specimen,
} from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { getPatientReference } from "./patient";
import { getSpecimenReference } from "./specimen";
import { getQuestDataSourceExtension } from "./shared";

export function getDiagnosticReport(
  detail: ResponseDetail,
  { patient, specimen }: { patient: Patient; specimen?: Specimen | undefined }
): DiagnosticReport {
  const effectiveDateTime = getEffectiveDateTime(detail);
  const subject = getPatientReference(patient);
  const identifier = getIdentifier(detail);
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
