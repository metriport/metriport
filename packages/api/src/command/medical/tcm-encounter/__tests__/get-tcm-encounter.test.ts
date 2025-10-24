import { NotFoundError } from "@metriport/shared";
import { getTcmEncounters } from "../get-tcm-encounters";
import { updateTcmEncounter, UpdateTcmEncounter } from "../update-tcm-encounter";
import { PatientModel } from "../../../../models/medical/patient";
import { TcmEncounterModel } from "../../../../models/medical/tcm-encounter";
import { makeEncounter, makePatient } from "./fixtures";
import { makePaginationWithCursor } from "../../__tests__/fixtures";

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
        pagination: makePaginationWithCursor(),
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
        pagination: makePaginationWithCursor(),
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
        pagination: makePaginationWithCursor(),
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
        pagination: makePaginationWithCursor(),
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
        pagination: makePaginationWithCursor(),
      };
      const result = await getTcmEncounters(cmd);
      expect(result[0].outreachLogs).toEqual(outreachLogs);
    });

    it("filters by multiple encounter classes", async () => {
      const encounter = makeEncounter({
        class: "emergency",
        patient: makePatient({
          patientData: {
            firstName: "Jane",
            lastName: "Smith",
            dob: "1985-05-15",
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
        encounterClass: ["emergency", "inpatient encounter"],
        pagination: makePaginationWithCursor(),
      };

      const result = await getTcmEncounters(cmd);

      expect(mockSequelize.query).toHaveBeenCalled();
      const [queryString, queryOptions] = mockSequelize.query.mock.calls[0];
      expect(queryString).toContain("tcm_encounter.class IN (:encounterClass)");
      expect(queryOptions.replacements.encounterClass).toEqual([
        "emergency",
        "inpatient encounter",
      ]);
      expect(result).toEqual([
        expect.objectContaining({
          class: "emergency",
          patientData: expect.objectContaining({
            firstName: "Jane",
            lastName: "Smith",
          }),
        }),
      ]);
    });

    it("sorts by patient firstName ascending", async () => {
      const encounter1 = makeEncounter({
        id: "enc-1",
        patient: makePatient({
          patientData: {
            firstName: "Alice",
            lastName: "Johnson",
            dob: "1990-01-01",
          },
        }),
      });

      const encounter2 = makeEncounter({
        id: "enc-2",
        patient: makePatient({
          patientData: {
            firstName: "Bob",
            lastName: "Smith",
            dob: "1985-05-15",
          },
        }),
      });

      const mockQueryResult = [
        {
          ...encounter1,
          dataValues: {
            ...encounter1.dataValues,
            patient_data: encounter1.PatientModel.data,
            patient_facility_ids: [],
            patient_mappings: [],
          },
        },
        {
          ...encounter2,
          dataValues: {
            ...encounter2.dataValues,
            patient_data: encounter2.PatientModel.data,
            patient_facility_ids: [],
            patient_mappings: [],
          },
        },
      ];

      mockSequelize.query.mockResolvedValue(mockQueryResult);

      const cmd = {
        cxId: "cx-123",
        pagination: {
          ...makePaginationWithCursor({
            count: 10,
          }),
          orderByClause: "ORDER BY patient.data->>'firstName' ASC",
        },
      };

      const result = await getTcmEncounters(cmd);

      expect(mockSequelize.query).toHaveBeenCalled();
      const [queryString] = mockSequelize.query.mock.calls[0];
      expect(queryString).toContain("ORDER BY patient.data->>'firstName' ASC");
      expect(result).toHaveLength(2);
      expect(result[0].patientData.firstName).toBe("Alice");
      expect(result[1].patientData.firstName).toBe("Bob");
    });

    it("sorts by patient lastName descending", async () => {
      const encounter1 = makeEncounter({
        id: "enc-1",
        patient: makePatient({
          patientData: {
            firstName: "John",
            lastName: "Zimmerman",
            dob: "1990-01-01",
          },
        }),
      });

      const encounter2 = makeEncounter({
        id: "enc-2",
        patient: makePatient({
          patientData: {
            firstName: "Jane",
            lastName: "Anderson",
            dob: "1985-05-15",
          },
        }),
      });

      const mockQueryResult = [
        {
          ...encounter1,
          dataValues: {
            ...encounter1.dataValues,
            patient_data: encounter1.PatientModel.data,
            patient_facility_ids: [],
            patient_mappings: [],
          },
        },
        {
          ...encounter2,
          dataValues: {
            ...encounter2.dataValues,
            patient_data: encounter2.PatientModel.data,
            patient_facility_ids: [],
            patient_mappings: [],
          },
        },
      ];

      mockSequelize.query.mockResolvedValue(mockQueryResult);

      const cmd = {
        cxId: "cx-123",
        pagination: {
          ...makePaginationWithCursor({
            count: 10,
          }),
          orderByClause: "ORDER BY patient.data->>'lastName' DESC",
        },
      };

      const result = await getTcmEncounters(cmd);

      expect(mockSequelize.query).toHaveBeenCalled();
      const [queryString] = mockSequelize.query.mock.calls[0];
      expect(queryString).toContain("ORDER BY patient.data->>'lastName' DESC");
      expect(result).toHaveLength(2);
      expect(result[0].patientData.lastName).toBe("Zimmerman");
      expect(result[1].patientData.lastName).toBe("Anderson");
    });

    it("handles pagination with patient name sort fields", async () => {
      const encounter = makeEncounter({
        patient: makePatient({
          patientData: {
            firstName: "Charlie",
            lastName: "Brown",
            dob: "1992-03-10",
          },
        }),
      });

      const mockQueryResult = [
        {
          ...encounter,
          dataValues: {
            ...encounter.dataValues,
            patient_data: encounter.PatientModel.data,
            patient_facility_ids: [],
            patient_mappings: [],
          },
        },
      ];

      mockSequelize.query.mockResolvedValue(mockQueryResult);

      const cmd = {
        cxId: "cx-123",
        pagination: {
          ...makePaginationWithCursor({
            count: 10,
            fromItem: {
              clause: "AND (patient.data->>'firstName' >= :cursor_firstName_0)",
              params: { cursor_firstName_0: "Charlie" },
            },
          }),
          orderByClause: "ORDER BY patient.data->>'firstName' ASC",
        },
      };

      const result = await getTcmEncounters(cmd);

      expect(mockSequelize.query).toHaveBeenCalled();
      const [queryString, queryOptions] = mockSequelize.query.mock.calls[0];
      expect(queryString).toContain("ORDER BY patient.data->>'firstName' ASC");
      expect(queryString).toContain("patient.data->>'firstName' >= :cursor_firstName_0");
      expect(queryOptions.replacements).toMatchObject({
        cursor_firstName_0: "Charlie",
      });
      expect(result).toEqual([
        expect.objectContaining({
          patientData: expect.objectContaining({
            firstName: "Charlie",
            lastName: "Brown",
          }),
        }),
      ]);
    });
  });
});
