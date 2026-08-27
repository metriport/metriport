import { faker } from "@faker-js/faker";
import { PatientRoster } from "@metriport/shared";
import { PatientRosterModel } from "../../../../../models/medical/patient-roster";

export type MakePatientRosterOverrides = Partial<
  Omit<PatientRoster, "eTag" | "createdAt" | "updatedAt">
>;

export function makePatientRoster(
  overrides: MakePatientRosterOverrides = {}
): Omit<PatientRoster, "eTag" | "createdAt" | "updatedAt"> {
  return {
    id: faker.string.uuid(),
    patientId: faker.string.uuid(),
    rosterId: faker.string.uuid(),
    ...overrides,
  };
}

export function makePatientRosterModel(
  overrides: MakePatientRosterOverrides = {}
): PatientRosterModel {
  const patientRoster = makePatientRoster(overrides);
  return {
    ...patientRoster,
    dataValues: patientRoster,
  } as unknown as PatientRosterModel;
}
