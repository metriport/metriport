import { NotFoundError } from "@metriport/shared";
import { getTcmEncounters } from "../get-tcm-encounters";
import { updateTcmEncounter, UpdateTcmEncounter } from "../update-tcm-encounter";
import { PatientModel } from "../../../../models/medical/patient";
import { TcmEncounterModel } from "../../../../models/medical/tcm-encounter";
import { makeEncounter, makePatient } from "./fixtures";

jest.mock("../../../../models/medical/tcm-encounter");
jest.mock("../../../../models/medical/patient");

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
      const encounter = makeEncounter({
        patient: makePatient({
          patientData: {
            firstName: "John",
            lastName: "Doe",
            dob: "1990-01-01",
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

      const cmd = {
        cxId: "cx-123",
        pagination: { count: 10, fromItem: undefined, toItem: undefined },
      };

      const result = await getTcmEncounters(cmd);

      expect(result).toEqual([
        expect.objectContaining({
          id: encounter.id,
          patientData: expect.objectContaining({
            firstName: "John",
            lastName: "Doe",
            dob: "1990-01-01",
          }),
        }),
      ]);
    });

    it("handles pagination correctly", async () => {
      const encounter = makeEncounter({
        facilityName: "Some Facility",
        patient: makePatient({
          patientData: {
            firstName: "John",
            lastName: "Doe",
            dob: "1990-01-01",
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

      const cmd = {
        cxId: "cx-123",
        pagination: { count: 1, fromItem: undefined, toItem: undefined },
      };

      const result = await getTcmEncounters(cmd);

      expect(result).toEqual([
        expect.objectContaining({
          facilityName: "Some Facility",
          patientData: expect.objectContaining({
            firstName: "John",
            lastName: "Doe",
            dob: "1990-01-01",
          }),
        }),
      ]);
    });

    it("filters by after date", async () => {
      const afterDate = "2025-06-17T19:52:55.461Z";
      const encounter = makeEncounter({
        patient: makePatient({
          patientData: {
            firstName: "John",
            lastName: "Doe",
            dob: "1990-01-01",
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

      const cmd = {
        cxId: "cx-123",
        after: afterDate,
        pagination: { count: 10, fromItem: undefined, toItem: undefined },
      };

      const result = await getTcmEncounters(cmd);

      expect(result).toEqual([
        expect.objectContaining({
          patientData: expect.objectContaining({
            firstName: "John",
            lastName: "Doe",
            dob: "1990-01-01",
          }),
        }),
      ]);
    });

    it("applies default filter for admit time > 2020", async () => {
      const encounter = makeEncounter({
        facilityName: "Some Facility",
        patient: makePatient({
          patientData: {
            firstName: "John",
            lastName: "Doe",
            dob: "1990-01-01",
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

      const cmd = {
        cxId: "cx-123",
        pagination: { count: 10, fromItem: undefined, toItem: undefined },
      };

      const result = await getTcmEncounters(cmd);

      expect(result).toEqual([
        expect.objectContaining({
          facilityName: "Some Facility",
          patientData: expect.objectContaining({
            firstName: "John",
            lastName: "Doe",
            dob: "1990-01-01",
          }),
        }),
      ]);
    });

    it("returns outreachLogs in the encounter result", async () => {
      const outreachLogs = [
        { status: "Attempted", timestamp: "2024-01-01T12:00:00Z" },
        { status: "Completed", timestamp: "2024-01-02T12:00:00Z" },
      ];
      const encounter = makeEncounter({ outreachLogs });
      const mockQueryResult = [
        {
          ...encounter,
          dataValues: {
            ...encounter.dataValues,
            outreachLogs,
            patient_data: encounter.PatientModel.data,
          },
        },
      ];
      mockSequelize.query.mockResolvedValue(mockQueryResult);
      const cmd = {
        cxId: "cx-123",
        pagination: { count: 10, fromItem: undefined, toItem: undefined },
      };
      const result = await getTcmEncounters(cmd);
      expect(result[0].outreachLogs).toEqual(outreachLogs);
    });
  });
});
