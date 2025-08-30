import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import {
  CodeableConcept,
  Coding,
  DiagnosticReport,
  Identifier,
  Observation,
  Patient,
  ServiceRequest,
  Specimen,
} from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { getPatientReference } from "./patient";
import { getSpecimenReference } from "./specimen";
import { getServiceRequestReference } from "./service-request";
import { getQuestDataSourceExtension } from "./shared";
import { getObservationReference } from "./observation";

export function getDiagnosticReport(
  detail: ResponseDetail,
  {
    patient,
    specimen,
    serviceRequest,
    observation,
  }: {
    patient: Patient;
    specimen?: Specimen | undefined;
    serviceRequest: ServiceRequest;
    observation: Observation;
  }
): DiagnosticReport {
  const effectiveDateTime = getEffectiveDateTime(detail);
  const code = getDiagnosticReportCoding(detail);
  const basedOn = [getServiceRequestReference(serviceRequest)];
  const subject = getPatientReference(patient);
  const result = [getObservationReference(observation)];
  const identifier = getIdentifier(detail);
  const specimenReference = specimen ? [getSpecimenReference(specimen)] : undefined;
  const category = getDiagnosticReportCategory(detail);
  const extension = [getQuestDataSourceExtension()];
  return {
    resourceType: "DiagnosticReport",
    id: uuidv7(),
    status: "final",
    effectiveDateTime,
    basedOn,
    identifier,
    subject,
    result,
    ...(code ? { code } : {}),
    ...(specimenReference ? { specimen: specimenReference } : {}),
    ...(category ? { category } : {}),
    extension,
  };
}

function getDiagnosticReportCoding(detail: ResponseDetail): CodeableConcept | undefined {
  if (!detail.loincCode) return undefined;
  return {
    coding: [
      {
        system: "http://loinc.org",
        code: detail.loincCode,
      },
    ],
  };
}

function getDiagnosticReportCategory(detail: ResponseDetail): CodeableConcept[] | undefined {
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
  return coding.length > 0 ? [{ coding }] : undefined;
}

function getEffectiveDateTime(detail: ResponseDetail): string {
  if (detail.dateCollected) {
    return detail.dateCollected.toISOString();
  }
  return detail.dateOfService.toISOString();
}

function getIdentifier(detail: ResponseDetail): Identifier[] {
  const identifier: Identifier[] = [
    {
      system: "https://questdiagnostics.com/identifier/accession",
      value: detail.accessionNumber,
    },
  ];
  if (detail.requisitionNumber) {
    identifier.push({
      system: "https://questdiagnostics.com/identifier/requisition",
      value: detail.requisitionNumber,
    });
  }
  return identifier;
}
