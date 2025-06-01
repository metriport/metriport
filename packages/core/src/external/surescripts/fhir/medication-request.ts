import { MedicationRequest } from "@medplum/fhirtypes";
import { FlatFileDetail } from "../schema/response";

export function getMedicationRequest(detail: FlatFileDetail): MedicationRequest {
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

function getDispenseRequest(detail: FlatFileDetail): MedicationRequest["dispenseRequest"] {
  const dispenseRequest: MedicationRequest["dispenseRequest"] = {};
  if (detail.fillNumber) {
    dispenseRequest.numberOfRepeatsAllowed = detail.fillNumber;
  }
  return dispenseRequest;
}

function getAuthoredOn(detail: FlatFileDetail): MedicationRequest["authoredOn"] | undefined {
  if (!detail.dateWritten) return undefined;
  return detail.dateWritten.toISOString();
}

function getDosageInstruction(
  detail: FlatFileDetail
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
  detail: FlatFileDetail
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
