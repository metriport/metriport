import { faker } from "@faker-js/faker";
import { makePatient } from "../../../../domain/__tests__/patient";
import { PatientPayload } from "../create/patient-import-create";

export function makePatientPayload(params: Partial<PatientPayload> = {}): PatientPayload {
  const { externalId, ...rest } = params;
  const patient = makePatient({
    ...rest,
    ...(externalId ? { externalId } : {}),
  });
  return {
    ...patient.data,
    externalId: externalId ?? patient.externalId ?? faker.string.uuid(),
  };
}
