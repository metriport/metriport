import { MedicationRequest } from "@medplum/fhirtypes";
import { FlatFileDetail } from "../schema/response";

export async function parseMedicationRequest(detail: FlatFileDetail): Promise<MedicationRequest> {
  const dosageInstruction = await parseMedicationRequestTiming(detail);
  const substitution = await parseMedicationRequestSubstitution(detail);

  return {
    resourceType: "MedicationRequest",
    ...(dosageInstruction && dosageInstruction.length > 0 ? { dosageInstruction } : null),
    ...(detail.dateWritten ? { authoredOn: detail.dateWritten.toISOString() } : null),
    ...(substitution ? { substitution } : null),
  };
}

async function parseMedicationRequestTiming(
  detail: FlatFileDetail
): Promise<MedicationRequest["dosageInstruction"]> {
  if (!detail.startDate || !detail.endDate) return [];
  return [
    {
      timing: {},
    },
  ];
}

async function parseMedicationRequestSubstitution(
  detail: FlatFileDetail
): Promise<MedicationRequest["substitution"]> {
  if (!detail.substitutions) return undefined;
  return {
    // allowedBoolean: detail.substitutions === "Y",
  };
}
