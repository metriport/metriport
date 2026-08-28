import { PatientLoader } from "../../command/patient-loader";
import { Patient, PatientData } from "../../domain/patient";
import { getPatientByDemo } from "../get-patient-by-demo";

const CX_ID = "cx-1";

const sharedDemo: PatientData = {
  firstName: "Jane",
  lastName: "Doe",
  dob: "1990-01-01",
  genderAtBirth: "F",
  personalIdentifiers: [{ type: "ssn", value: "999-99-9999" }],
  address: [
    {
      addressLine1: "123 Main St",
      city: "Springfield",
      state: "IL",
      zip: "62701",
      country: "USA",
    },
  ],
};

function makePatient({
  id,
  createdAt,
  ssn,
}: {
  id: string;
  createdAt: Date;
  ssn: string;
}): Patient {
  return {
    id,
    cxId: CX_ID,
    facilityIds: ["facility-1"],
    eTag: "etag",
    createdAt,
    updatedAt: createdAt,
    data: {
      firstName: "Jane",
      lastName: "Doe",
      dob: "1990-01-01",
      genderAtBirth: "F",
      personalIdentifiers: [{ type: "ssn", value: ssn }],
      address: sharedDemo.address,
    },
  } as Patient;
}

function makePatientLoader(patients: Patient[]): PatientLoader {
  async function getStatesFromPatientIds() {
    return [];
  }

  async function getOneOrFail({ id, cxId }: { id: string; cxId: string }) {
    const patient = patients.find(function (p) {
      return p.id === id && p.cxId === cxId;
    });
    if (!patient) {
      throw new Error(`Patient not found: ${id}`);
    }
    return patient;
  }

  async function findBySimilarityAcrossAllCxs() {
    return patients;
  }

  async function findBySimilarity() {
    return patients;
  }

  return {
    getStatesFromPatientIds,
    getOneOrFail,
    findBySimilarityAcrossAllCxs,
    findBySimilarity,
  };
}

describe("getPatientByDemo", () => {
  it("returns the oldest patient when multiple demographic matches exist", async () => {
    const oldestPatient = makePatient({
      id: "patient-oldest",
      createdAt: new Date("2020-06-01T10:00:00.800Z"),
      ssn: "111-11-1111",
    });
    const newerPatient = makePatient({
      id: "patient-newer",
      createdAt: new Date("2023-01-15T14:30:00.200Z"),
      ssn: "222-22-2222",
    });

    const patientLoader = makePatientLoader([newerPatient, oldestPatient]);

    const result = await getPatientByDemo({
      cxId: CX_ID,
      demo: sharedDemo,
      patientLoader,
    });

    expect(result?.id).toBe("patient-oldest");
  });
});
