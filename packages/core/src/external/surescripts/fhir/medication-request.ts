import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { buildDayjs } from "@metriport/shared/common/date";
import { Medication, MedicationRequest } from "@medplum/fhirtypes";
import type { SurescriptsContext } from "./types";
import { ResponseDetail } from "../schema/response";
import { getMedicationReference } from "./medication";
import { getSurescriptsDataSourceExtension } from "./shared";

export function getMedicationRequest(
  context: SurescriptsContext,
  medication: Medication,
  detail: ResponseDetail
): MedicationRequest {
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
    ...(note ? { note } : undefined),
    ...(category ? { category } : undefined),
    ...(authoredOn ? { authoredOn } : undefined),
    ...(dispenseRequest ? { dispenseRequest } : undefined),
    ...(dosageInstruction ? { dosageInstruction } : undefined),
    ...(substitution ? { substitution } : undefined),
    extension,
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
