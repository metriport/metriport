import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import {
  CodeableConcept,
  DiagnosticReport,
  Identifier,
  Observation,
  Patient,
  ServiceRequest,
  Specimen,
} from "@medplum/fhirtypes";
import { LOINC_URL } from "@metriport/shared/medical";
import { ResponseDetail } from "../schema/response";
import { getPatientReference } from "./patient";
import { getSpecimenReference } from "./specimen";
import { getDiagnosticReportCategory } from "../../fhir/resources/diagnostic-report";
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
  const category = [getDiagnosticReportCategory("LAB")];
  const basedOn = [getServiceRequestReference(serviceRequest)];
  const subject = getPatientReference(patient);
  const issued = getDiagnosticReportIssued(detail);
  const result = [getObservationReference(observation)];
  const identifier = getIdentifier(detail);
  const specimenReference = specimen ? [getSpecimenReference(specimen)] : undefined;
  const extension = [getQuestDataSourceExtension()];

  return {
    resourceType: "DiagnosticReport",
    id: uuidv7(),
    status: "final",
    effectiveDateTime,
    issued,
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
        system: LOINC_URL,
        code: detail.loincCode,
      },
    ],
  };
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

function getEffectiveDateTime(detail: ResponseDetail): string {
  if (detail.dateCollected) {
    return detail.dateCollected.toISOString();
  }
  return detail.dateOfService.toISOString();
}

function getDiagnosticReportIssued({ dateOfService }: ResponseDetail): string {
  return dateOfService.toISOString();
}
