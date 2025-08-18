import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  Medication,
  MedicationRequest,
  Patient,
  Practitioner,
  Reference,
  Coverage,
  Identifier,
  CodeableConcept,
  Organization,
} from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { getMedicationReference } from "./medication";
import { getPatientReference } from "./patient";
import { getCoverageReference } from "./coverage";
import { getPharmacyReference } from "./pharmacy";
import { getSurescriptsDataSourceExtension } from "./shared";
import { ICD_10_URL } from "@metriport/shared/medical";
import { HL7_CODE_SYSTEM_URL } from "./constants";

export function getMedicationRequest({
  patient,
  prescriber,
  pharmacy,
  medication,
  coverage,
  detail,
}: {
  patient: Patient;
  prescriber?: Practitioner | undefined;
  pharmacy?: Organization | undefined;
  medication: Medication;
  coverage: Coverage | undefined;
  detail: ResponseDetail;
}): MedicationRequest {
  const requester = getRequester(prescriber);
  const identifier = getMedicationRequestIdentifier(detail);
  const subject = getPatientReference(patient);
  const insurance = coverage ? [getCoverageReference(coverage)] : undefined;
  const dispenseRequest = getDispenseRequest(detail);
  const note = getDispenseNote(detail);
  const substitution = getMedicationRequestSubstitution(detail);
  const medicationReference = getMedicationReference(medication);
  const dosageInstruction = getDosageInstruction(detail);
  const authoredOn = getAuthoredOn(detail);
  const category = getDispenseCategory();
  const reasonCode = getReasonCode(detail);
  const performer = pharmacy ? getPharmacyReference(pharmacy) : undefined;
  const extension = [getSurescriptsDataSourceExtension()];

  return {
    resourceType: "MedicationRequest",
    id: uuidv7(),
    status: "completed",
    intent: "order",
    medicationReference,
    subject,
    ...(identifier ? { identifier } : undefined),
    ...(insurance ? { insurance } : undefined),
    ...(requester ? { requester } : undefined),
    ...(note ? { note } : undefined),
    ...(category ? { category } : undefined),
    ...(authoredOn ? { authoredOn } : undefined),
    ...(dispenseRequest ? { dispenseRequest } : undefined),
    ...(dosageInstruction ? { dosageInstruction } : undefined),
    ...(substitution ? { substitution } : undefined),
    ...(reasonCode ? { reasonCode } : undefined),
    ...(performer ? { performer } : undefined),
    extension,
  };
}

function getMedicationRequestIdentifier(detail: ResponseDetail): Identifier[] | undefined {
  const identifiers: Identifier[] = [];
  if (detail.rxReferenceNumber) {
    identifiers.push({
      system: HL7_CODE_SYSTEM_URL,
      type: {
        coding: [
          {
            system: HL7_CODE_SYSTEM_URL,
            code: "RXN",
            display: "Rx Number",
          },
        ],
      },
      value: detail.rxReferenceNumber,
    });
  }
  if (identifiers.length > 0) return identifiers;
  return undefined;
}

export function getRequester(
  prescriber?: Practitioner
): MedicationRequest["requester"] | undefined {
  if (!prescriber) return undefined;
  const display = prescriber.name?.[0]?.text ?? "";
  return {
    reference: `Practitioner/${prescriber.id}`,
    ...(display ? { display } : undefined),
  };
}

export function getMedicationRequestReference(
  medicationRequest: MedicationRequest
): Reference<MedicationRequest> {
  return {
    reference: `MedicationRequest/${medicationRequest.id}`,
  };
}

function getDispenseRequest(
  detail: ResponseDetail
): MedicationRequest["dispenseRequest"] | undefined {
  if (detail.fillNumber) {
    return { numberOfRepeatsAllowed: detail.fillNumber };
  }
  return undefined;
}

function getDispenseCategory(): MedicationRequest["category"] {
  return [
    {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/medicationrequest-category",
          code: "outpatient",
        },
      ],
    },
  ];
}

function getAuthoredOn(detail: ResponseDetail): MedicationRequest["authoredOn"] | undefined {
  if (!detail.dateWritten) return undefined;
  return buildDayjs(detail.dateWritten).toISOString();
}

function getDosageInstruction(
  detail: ResponseDetail
): MedicationRequest["dosageInstruction"] | undefined {
  if (!detail.directions) return undefined;
  return [
    {
      text: detail.directions,
    },
  ];
}

function getDispenseNote(detail: ResponseDetail): MedicationRequest["note"] | undefined {
  if (!detail.directions) return undefined;
  return [
    {
      text: detail.directions,
    },
  ];
}
// Field 36 of the FFM specification
function getMedicationRequestSubstitution(
  detail: ResponseDetail
): MedicationRequest["substitution"] | undefined {
  if (detail.substitutions === "1") {
    return {
      allowedBoolean: true,
    };
  }
  if (detail.substitutions === "0") {
    return {
      allowedBoolean: false,
    };
  }
  return undefined;
}

function getReasonCode(detail: ResponseDetail): CodeableConcept[] | undefined {
  if (!detail.diagnosisICD10Code) return undefined;
  return [
    {
      coding: [
        {
          system: ICD_10_URL,
          code: detail.diagnosisICD10Code,
        },
      ],
    },
  ];
}
