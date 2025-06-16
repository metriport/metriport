import { MedicationRequest } from "@medplum/fhirtypes";
import type { SurescriptsContext } from "./types";
import { ResponseDetail } from "../schema/response";

export function getMedicationRequest(
  context: SurescriptsContext,
  detail: ResponseDetail
): MedicationRequest {
  const dispenseRequest = getDispenseRequest(detail);
  const substitution = getMedicationRequestSubstitution(detail);
  const dosageInstruction = getDosageInstruction(detail);
  const authoredOn = getAuthoredOn(detail);

  return {
    resourceType: "MedicationRequest",
    ...(dispenseRequest ? { dispenseRequest } : undefined),
    ...(dosageInstruction ? { dosageInstruction } : undefined),
    ...(authoredOn ? { authoredOn } : undefined),
    ...(substitution ? { substitution } : undefined),
  };
}

function getDispenseRequest(detail: ResponseDetail): MedicationRequest["dispenseRequest"] {
  const dispenseRequest: MedicationRequest["dispenseRequest"] = {};
  if (detail.fillNumber) {
    dispenseRequest.numberOfRepeatsAllowed = detail.fillNumber;
  }
  return dispenseRequest;
}

function getAuthoredOn(detail: ResponseDetail): MedicationRequest["authoredOn"] | undefined {
  if (!detail.dateWritten) return undefined;
  return detail.dateWritten.toISOString();
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

// Field 36 of the FFM specification
function getMedicationRequestSubstitution(
  detail: ResponseDetail
): MedicationRequest["substitution"] {
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
