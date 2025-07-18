import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  Medication,
  MedicationRequest,
  Patient,
  Practitioner,
  Reference,
  Coverage,
} from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { getMedicationReference } from "./medication";
import { getPatientReference } from "./patient";
import { getCoverageReference } from "./coverage";
import { getSurescriptsDataSourceExtension } from "./shared";

export function getMedicationRequest({
  patient,
  prescriber,
  medication,
  coverage,
  detail,
}: {
  patient: Patient;
  prescriber?: Practitioner | undefined;
  medication: Medication;
  coverage: Coverage | undefined;
  detail: ResponseDetail;
}): MedicationRequest {
  const requester = getRequester(prescriber);
  const subject = getPatientReference(patient);
  const insurance = coverage ? [getCoverageReference(coverage)] : undefined;
  const dispenseRequest = getDispenseRequest(detail);
  const note = getDispenseNote(detail);
  const substitution = getMedicationRequestSubstitution(detail);
  const medicationReference = getMedicationReference(medication);
  const dosageInstruction = getDosageInstruction(detail);
  const authoredOn = getAuthoredOn(detail);
  const category = getDispenseCategory();
  const extension = [getSurescriptsDataSourceExtension()];

  return {
    resourceType: "MedicationRequest",
    id: uuidv7(),
    status: "completed",
    medicationReference,
    subject,
    ...(insurance ? { insurance } : undefined),
    ...(requester ? { requester } : undefined),
    ...(note ? { note } : undefined),
    ...(category ? { category } : undefined),
    ...(authoredOn ? { authoredOn } : undefined),
    ...(dispenseRequest ? { dispenseRequest } : undefined),
    ...(dosageInstruction ? { dosageInstruction } : undefined),
    ...(substitution ? { substitution } : undefined),
    extension,
  };
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
