import { makePatientData } from "@metriport/core/domain/__tests__/patient";

export function makePatient(
  overrides: { patientData?: Partial<ReturnType<typeof makePatientData>> } & Record<
    string,
    unknown
  > = {}
) {
  const patientData = makePatientData(overrides.patientData);
  return {
    id: "patient-123",
    cxId: "cx-123",
    data: patientData,
    dataValues: {
      id: "patient-123",
      cxId: "cx-123",
      data: patientData,
    },
    ...overrides,
  };
}

export function makeEncounter(
  overrides: { patient?: Partial<ReturnType<typeof makePatient>> } & Record<string, unknown> = {}
) {
  const patient = makePatient(overrides.patient);
  const baseEncounter = {
    id: "enc-1",
    cxId: "cx-123",
    patientId: "patient-123",
    facilityName: "Test Facility",
    latestEvent: "Admitted" as const,
    class: "Test Class",
    admitTime: new Date("2023-01-01"),
    dischargeTime: null,
    clinicalInformation: {},
    PatientModel: patient,
    get: jest.fn().mockReturnValue(patient),
  };

  return {
    ...baseEncounter,
    ...overrides,
    dataValues: {
      ...baseEncounter,
      ...overrides,
      PatientModel: patient,
    },
  };
}
