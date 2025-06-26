import { NotFoundError } from "@metriport/shared";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { PatientModel } from "../../../models/medical/patient";
import {
  updateTcmEncounter,
  UpdateTcmEncounter,
} from "../../../command/medical/tcm-encounter/update-tcm-encounter";
import {
  getTcmEncounters,
  GetTcmEncountersCmd,
} from "../../../command/medical/tcm-encounter/get-tcm-encounters";

jest.mock("../../../models/medical/tcm-encounter");
jest.mock("../../../models/medical/patient");

describe("TCM Encounter Commands", () => {
  const mockSequelize = {
    query: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    /**
     * Stub and set key fields for models usually set up during initialization
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (TcmEncounterModel as any).sequelize = mockSequelize;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (TcmEncounterModel as any).tableName = "tcm_encounter";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (PatientModel as any).tableName = "patient";
  });

  function makePatientData(
    overrides: Partial<{
      firstName: string;
      lastName: string;
      dob: string;
      contact: Array<{ phone: string }>;
      address: Array<{ state: string }>;
    }> = {}
  ) {
    return {
      firstName: "John",
      lastName: "Doe",
      dob: "1990-01-01",
      contact: [{ phone: "555-1234" }],
      address: [{ state: "CA" }],
      ...overrides,
    };
  }

  function makePatient(
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

  function makeEncounter(
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

  describe("updateTcmEncounter", () => {
    it("updates an existing TCM encounter", async () => {
      const updatePayload: UpdateTcmEncounter = {
        id: "enc-1",
        cxId: "cx-123",
        latestEvent: "Discharged",
        dischargeTime: new Date("2024-03-21T16:00:00Z"),
      };

      const encounter = makeEncounter({
        latestEvent: "Discharged",
        dischargeTime: new Date("2024-03-21T16:00:00Z"),
      });

      (TcmEncounterModel.findByPk as jest.Mock).mockResolvedValue(encounter);
      (TcmEncounterModel.update as jest.Mock).mockResolvedValue([1]);

      const result = await updateTcmEncounter(updatePayload);

      expect(TcmEncounterModel.findByPk).toHaveBeenCalledWith("enc-1");
      expect(TcmEncounterModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          latestEvent: "Discharged",
          dischargeTime: new Date("2024-03-21T16:00:00Z"),
        }),
        expect.objectContaining({
          where: { id: "enc-1", cxId: "cx-123" },
        })
      );
      expect(result.encounter).toEqual(encounter);
    });

    it("throws NotFoundError for non-existent encounter", async () => {
      const updatePayload: UpdateTcmEncounter = {
        id: "enc-1",
        cxId: "cx-123",
        latestEvent: "Discharged",
      };

      (TcmEncounterModel.findByPk as jest.Mock).mockResolvedValue(null);

      await expect(updateTcmEncounter(updatePayload)).rejects.toThrow(NotFoundError);
      expect(TcmEncounterModel.findByPk).toHaveBeenCalledWith("enc-1");
    });
  });

  describe("getTcmEncounters", () => {
    it("returns list of encounters with default filters", async () => {
      const encounter = makeEncounter();
      const mockQueryResult = [
        {
          ...encounter,
          dataValues: {
            ...encounter.dataValues,
            patient_data: encounter.PatientModel.data,
          },
        },
      ];

      mockSequelize.query.mockResolvedValue(mockQueryResult);

      const cmd: GetTcmEncountersCmd = {
        cxId: "cx-123",
        pagination: { count: 10, fromItem: undefined, toItem: undefined },
      };

      const result = await getTcmEncounters(cmd);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT tcm_encounter.*, patient.data as patient_data"),
        expect.objectContaining({
          replacements: expect.objectContaining({
            cxId: "cx-123",
            count: 10,
            afterDate: new Date("2020-01-01T00:00:00.000Z"),
          }),
        })
      );
      expect(result).toEqual([
        expect.objectContaining({
          id: "enc-1",
          patientName: "John Doe",
          patientDateOfBirth: "1990-01-01",
          patientPhoneNumbers: ["555-1234"],
          patientStates: ["CA"],
        }),
      ]);
    });

    it("handles pagination correctly", async () => {
      const encounter = makeEncounter({
        patient: makePatient({
          patientData: {
            firstName: "Jane",
            lastName: "Smith",
            dob: "1985-05-15",
            contact: [{ phone: "555-5678" }],
            address: [{ state: "NY" }],
          },
        }),
      });

      const mockQueryResult = [
        {
          ...encounter,
          dataValues: {
            ...encounter.dataValues,
            patient_data: encounter.PatientModel.data,
          },
        },
      ];

      mockSequelize.query.mockResolvedValue(mockQueryResult);

      const cmd: GetTcmEncountersCmd = {
        cxId: "cx-123",
        pagination: { count: 1, fromItem: undefined, toItem: undefined },
      };

      const result = await getTcmEncounters(cmd);

      expect(result).toEqual([
        expect.objectContaining({
          patientName: "Jane Smith",
          patientDateOfBirth: "1985-05-15",
          patientPhoneNumbers: ["555-5678"],
          patientStates: ["NY"],
        }),
      ]);
    });

    it("filters by after date", async () => {
      const afterDate = "2025-06-17T19:52:55.461Z";
      const encounter = makeEncounter({
        patient: makePatient({
          patientData: {
            firstName: "Bob",
            lastName: "Johnson",
            dob: "1975-12-10",
            contact: [],
            address: [],
          },
        }),
        admitTime: new Date("2025-07-01"),
      });

      const mockQueryResult = [
        {
          ...encounter,
          dataValues: {
            ...encounter.dataValues,
            patient_data: encounter.PatientModel.data,
          },
        },
      ];

      mockSequelize.query.mockResolvedValue(mockQueryResult);

      const cmd: GetTcmEncountersCmd = {
        cxId: "cx-123",
        after: afterDate,
        pagination: { count: 10, fromItem: undefined, toItem: undefined },
      };

      const result = await getTcmEncounters(cmd);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT tcm_encounter.*, patient.data as patient_data"),
        expect.objectContaining({
          replacements: expect.objectContaining({
            cxId: "cx-123",
            afterDate: new Date(afterDate),
          }),
        })
      );
      expect(result).toEqual([
        expect.objectContaining({
          patientName: "Bob Johnson",
          patientDateOfBirth: "1975-12-10",
          patientPhoneNumbers: [],
          patientStates: [],
        }),
      ]);
    });

    it("applies default filter for admit time > 2020", async () => {
      const encounter = makeEncounter({
        patient: makePatient({
          patientData: {
            firstName: "Alice",
            lastName: "Brown",
            dob: "1995-08-20",
            contact: [{ phone: "555-9999" }],
            address: [{ state: "TX" }],
          },
        }),
        facilityName: "Default Facility",
        class: "Default Class",
        admitTime: new Date("2023-06-01"),
      });

      const mockQueryResult = [
        {
          ...encounter,
          dataValues: {
            ...encounter.dataValues,
            patient_data: encounter.PatientModel.data,
          },
        },
      ];

      mockSequelize.query.mockResolvedValue(mockQueryResult);

      const cmd: GetTcmEncountersCmd = {
        cxId: "cx-123",
        pagination: { count: 10, fromItem: undefined, toItem: undefined },
      };

      const result = await getTcmEncounters(cmd);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT tcm_encounter.*, patient.data as patient_data"),
        expect.objectContaining({
          replacements: expect.objectContaining({
            cxId: "cx-123",
            afterDate: new Date("2020-01-01T00:00:00.000Z"),
          }),
        })
      );
      expect(result).toEqual([
        expect.objectContaining({
          facilityName: "Default Facility",
          class: "Default Class",
          patientName: "Alice Brown",
          patientDateOfBirth: "1995-08-20",
          patientPhoneNumbers: ["555-9999"],
          patientStates: ["TX"],
        }),
      ]);
    });
  });
});
