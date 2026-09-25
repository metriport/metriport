import { PatientLoader } from "../../command/patient-loader";
import { PatientData } from "../../domain/patient";
import { getPatientByDemo } from "../get-patient-by-demo";

jest.mock("../normalize-patient", () => ({ normalizePatient: (patient: PatientData) => patient }));
jest.mock("../match-patients", () => ({
  jaroWinklerSimilarity: jest.fn(),
  matchingPersonalIdentifiersRule: jest.fn(),
  matchPatients: (_similarity: unknown, _rules: unknown, patients: { id: string }[]) => patients,
}));
jest.mock("../shared", () => ({
  patientToPatientMPI: (patient: { id: string }) => ({ id: patient.id }),
}));
jest.mock("../../util/log", () => ({ log: jest.fn() }));

describe("getPatientByDemo", () => {
  it("chooses the oldest matching patient across different seconds and days", async () => {
    const newer = { id: "newer", createdAt: new Date("2024-01-02T00:00:00.100Z") };
    const older = { id: "older", createdAt: new Date("2024-01-01T00:00:00.900Z") };
    const patientLoader = {
      findBySimilarity: jest.fn().mockResolvedValue([newer, older]),
      getOneOrFail: jest
        .fn()
        .mockImplementation(({ id }) => Promise.resolve(id === older.id ? older : newer)),
    } as unknown as PatientLoader;

    const result = await getPatientByDemo({
      cxId: "customer",
      demo: { dob: "1947-09-10", genderAtBirth: "M" } as PatientData,
      patientLoader,
    });

    expect(result).toBe(older);
    expect(patientLoader.getOneOrFail).toHaveBeenCalledWith({ id: "older", cxId: "customer" });
  });
});
