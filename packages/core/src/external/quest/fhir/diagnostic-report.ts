import {
  CodeableConcept,
  DiagnosticReport,
  Identifier,
  Observation,
  Patient,
  ServiceRequest,
  Specimen,
} from "@medplum/fhirtypes";
import { GENERIC_LOINC_LAB_RESULT_CODE, LOINC_URL } from "@metriport/shared/medical";
import { stringToBase64 } from "@metriport/shared/util/base64";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { getDiagnosticReportCategory } from "../../fhir/resources/diagnostic-report";
import { ResponseDetail } from "../schema/response";
import { getObservationReference } from "./observation";
import { getPatientReference } from "./patient";
import { getServiceRequestReference } from "./service-request";
import { getQuestDataSourceExtension } from "./shared";
import { getSpecimenReference } from "./specimen";

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
  const presentedForm = getPresentedForm(detail);

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
    ...(presentedForm ? { presentedForm } : {}),
    extension,
  };
}

function getPresentedForm(detail: ResponseDetail): DiagnosticReport["presentedForm"] | undefined {
  if (!detail.resultComments || detail.resultComments.trim().length === 0) return undefined;
  return [{ contentType: "text/plain", data: stringToBase64(detail.resultComments) }];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getDiagnosticReportCoding(detail: ResponseDetail): CodeableConcept | undefined {
  return {
    coding: [
      {
        system: LOINC_URL,
        // TODO ENG-1780: Add proper mapping from STANDARD_PROFILE_CODE in the source data to a loinc code.
        code: GENERIC_LOINC_LAB_RESULT_CODE,
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
