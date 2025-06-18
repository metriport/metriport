import { Request, Response } from "express";
import httpStatus from "http-status";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { PatientModel } from "../../../models/medical/patient";
import { handleUpdateTcmEncounter, handleListTcmEncounters } from "../tcm-encounter";

jest.mock("../../../models/medical/tcm-encounter");
jest.mock("../../../models/medical/patient");

describe("TCM Encounter Handlers", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {
      params: { id: "1bdb5013-bb41-4c22-8429-07968d89e653" },
      body: { latestEvent: "Discharged", dischargeTime: "2024-03-21T16:00:00Z" },
      cxId: "81f7abc4-3924-454f-ba4e-e10e26eda8af",
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe("handleUpdateTcmEncounter", () => {
    it("updates an existing TCM encounter", async () => {
      const encounter = {
        id: req.params?.id,
        cxId: req.cxId,
        patientId: "patient-123",
        facilityName: "Test Facility",
        latestEvent: "Discharged" as const,
        class: "Test Class",
        admitTime: new Date("2024-03-20T10:00:00Z"),
        dischargeTime: new Date("2024-03-21T16:00:00Z"),
        clinicalInformation: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (TcmEncounterModel.findByPk as jest.Mock).mockResolvedValue(encounter);
      (TcmEncounterModel.update as jest.Mock).mockResolvedValue([1]);

      await handleUpdateTcmEncounter(req as Request, res as Response);

      expect(TcmEncounterModel.findByPk).toHaveBeenCalledWith(req.params?.id);
      expect(TcmEncounterModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          latestEvent: "Discharged",
          dischargeTime: new Date("2024-03-21T16:00:00Z"),
        }),
        expect.objectContaining({
          where: { id: req.params?.id, cxId: req.cxId },
        })
      );
      expect(res.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(encounter);
    });

    it("returns 404 for non-existent encounter", async () => {
      (TcmEncounterModel.findByPk as jest.Mock).mockResolvedValue(null);

      await handleUpdateTcmEncounter(req as Request, res as Response);

      expect(TcmEncounterModel.findByPk).toHaveBeenCalledWith(req.params?.id);
      expect(res.status).toHaveBeenCalledWith(httpStatus.NOT_FOUND);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `TCM encounter not found`,
        })
      );
    });
  });

  describe("handleListTcmEncounters", () => {
    it("returns list of encounters with default filters", async () => {
      const mockPatientData = {
        firstName: "John",
        lastName: "Doe",
        dob: "1990-01-01",
        contact: [{ phone: "555-1234" }],
        address: [{ state: "CA" }],
      };

      const mockPatient = {
        id: "patient-101",
        cxId: "cx123",
        data: mockPatientData,
        dataValues: {
          id: "patient-101",
          cxId: "cx123",
          data: mockPatientData,
        },
      };

      const sampleEncounter = {
        id: "1",
        patientId: "patient-123",
        facilityName: "Facility A",
        latestEvent: "Admitted",
        class: "Class A",
        admitTime: new Date("2023-01-01"),
        dischargeTime: null,
        clinicalInformation: {},
        PatientModel: mockPatient,
        get: jest.fn().mockReturnValue(mockPatient),
        dataValues: {
          id: "1",
          patientId: "patient-123",
          facilityName: "Facility A",
          latestEvent: "Admitted",
          class: "Class A",
          admitTime: new Date("2023-01-01"),
          dischargeTime: null,
          clinicalInformation: {},
          PatientModel: mockPatient,
        },
      };

      const mockEncounters = [sampleEncounter];
      (TcmEncounterModel.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: mockEncounters,
        count: 1,
      });

      const req = {
        query: {},
        cxId: "cx123",
      } as unknown as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await handleListTcmEncounters(req, res);

      const expectedQuery = {
        where: {
          cxId: "cx123",
          admitTime: {
            [Symbol.for("gt")]: new Date("2020-01-01T00:00:00.000Z"),
          },
        },
        include: [
          {
            model: PatientModel,
            as: "PatientModel",
            attributes: ["id", "cxId", "data"],
          },
        ],
        order: [["admitTime", "DESC"]], // Most recent encounters first
      };

      expect(TcmEncounterModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining(expectedQuery)
      );
      expect(res.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({
        items: expect.arrayContaining([
          expect.objectContaining({
            id: "1",
            patientId: "patient-123",
            facilityName: "Facility A",
            latestEvent: "Admitted",
            class: "Class A",
            admitTime: new Date("2023-01-01"),
            dischargeTime: null,
            clinicalInformation: {},
            patientName: "John Doe",
            patientDateOfBirth: "1990-01-01",
            patientPhoneNumbers: ["555-1234"],
            patientStates: ["CA"],
          }),
        ]),
        meta: {
          itemsInTotal: 1,
          itemsOnPage: 1,
        },
      });
    });

    it("handles pagination with page size of 1 and two items", async () => {
      const mockPatientData = {
        firstName: "Jane",
        lastName: "Smith",
        dob: "1985-05-15",
        contact: [{ phone: "555-5678" }],
        address: [{ state: "NY" }],
      };

      const mockPatient = {
        id: "patient-456",
        cxId: "cx123",
        data: mockPatientData,
        dataValues: {
          id: "patient-456",
          cxId: "cx123",
          data: mockPatientData,
        },
      };

      const firstPage = [
        {
          id: "1",
          patientId: "patient-456",
          facilityName: "Facility A",
          latestEvent: "Admitted",
          class: "Class A",
          admitTime: new Date("2023-01-01"),
          dischargeTime: null,
          clinicalInformation: {},
          PatientModel: mockPatient,
          get: jest.fn().mockReturnValue(mockPatient),
          dataValues: {
            id: "1",
            patientId: "patient-456",
            facilityName: "Facility A",
            latestEvent: "Admitted",
            class: "Class A",
            admitTime: new Date("2023-01-01"),
            dischargeTime: null,
            clinicalInformation: {},
            PatientModel: mockPatient,
          },
        },
      ];
      const total = 2;
      const pageLimit = 1;
      (TcmEncounterModel.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: firstPage,
        count: total,
      });

      const req = {
        query: { limit: pageLimit, offset: 0 },
        cxId: "cx123",
      } as unknown as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await handleListTcmEncounters(req, res);

      expect(res.json).toHaveBeenCalledWith({
        items: expect.arrayContaining([
          expect.objectContaining({
            id: "1",
            patientId: "patient-456",
            facilityName: "Facility A",
            latestEvent: "Admitted",
            class: "Class A",
            admitTime: new Date("2023-01-01"),
            dischargeTime: null,
            clinicalInformation: {},
            patientName: "Jane Smith",
            patientDateOfBirth: "1985-05-15",
            patientPhoneNumbers: ["555-5678"],
            patientStates: ["NY"],
          }),
        ]),
        meta: {
          itemsInTotal: total,
          itemsOnPage: pageLimit,
        },
      });
    });

    it("filters by after date", async () => {
      req.query = { after: "2025-06-17T19:52:55.461Z" };
      const mockPatientData = {
        firstName: "Bob",
        lastName: "Johnson",
        dob: "1975-12-10",
        contact: [],
        address: [],
      };

      const mockPatient = {
        id: "patient-789",
        cxId: req.cxId,
        data: mockPatientData,
        dataValues: {
          id: "patient-789",
          cxId: req.cxId,
          data: mockPatientData,
        },
      };

      const encounters = [
        {
          id: "1",
          cxId: req.cxId,
          patientId: "patient-789",
          facilityName: "Test Facility",
          latestEvent: "Admitted" as const,
          class: "Test Class",
          admitTime: new Date("2025-07-01"),
          dischargeTime: null,
          clinicalInformation: {},
          PatientModel: mockPatient,
          get: jest.fn().mockReturnValue(mockPatient),
          dataValues: {
            id: "1",
            cxId: req.cxId,
            patientId: "patient-789",
            facilityName: "Test Facility",
            latestEvent: "Admitted",
            class: "Test Class",
            admitTime: new Date("2025-07-01"),
            dischargeTime: null,
            clinicalInformation: {},
            PatientModel: mockPatient,
          },
        },
      ];
      (TcmEncounterModel.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: encounters,
        count: 1,
      });

      await handleListTcmEncounters(req as Request, res as Response);

      expect(TcmEncounterModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cxId: req.cxId,
            admitTime: expect.objectContaining({
              [Symbol.for("gt")]: new Date(req.query.after as string),
            }),
          }),
          include: [
            {
              model: PatientModel,
              as: "PatientModel",
              attributes: ["id", "cxId", "data"],
            },
          ],
        })
      );
      expect(res.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              id: "1",
              cxId: req.cxId,
              patientId: "patient-789",
              facilityName: "Test Facility",
              latestEvent: "Admitted",
              class: "Test Class",
              admitTime: new Date("2025-07-01"),
              dischargeTime: null,
              clinicalInformation: {},
              patientName: "Bob Johnson",
              patientDateOfBirth: "1975-12-10",
              patientPhoneNumbers: [],
              patientStates: [],
            }),
          ]),
        })
      );
    });

    it("applies default filter for admit time > 2020", async () => {
      const mockPatientData = {
        firstName: "Alice",
        lastName: "Brown",
        dob: "1995-08-20",
        contact: [{ phone: "555-9999" }],
        address: [{ state: "TX" }],
      };

      const mockPatient = {
        id: "patient-101",
        cxId: req.cxId,
        data: mockPatientData,
        dataValues: {
          id: "patient-101",
          cxId: req.cxId,
          data: mockPatientData,
        },
      };

      const encounters = [
        {
          id: "1",
          cxId: req.cxId,
          patientId: "patient-101",
          facilityName: "Default Facility",
          latestEvent: "Admitted" as const,
          class: "Default Class",
          admitTime: new Date("2023-06-01"),
          dischargeTime: null,
          clinicalInformation: {},
          PatientModel: mockPatient,
          get: jest.fn().mockReturnValue(mockPatient),
          dataValues: {
            id: "1",
            cxId: req.cxId,
            patientId: "patient-101",
            facilityName: "Default Facility",
            latestEvent: "Admitted",
            class: "Default Class",
            admitTime: new Date("2023-06-01"),
            dischargeTime: null,
            clinicalInformation: {},
            PatientModel: mockPatient,
          },
        },
      ];
      (TcmEncounterModel.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: encounters,
        count: 1,
      });

      await handleListTcmEncounters(req as Request, res as Response);

      expect(TcmEncounterModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cxId: req.cxId,
            admitTime: expect.objectContaining({
              [Symbol.for("gt")]: new Date("2020-01-01T00:00:00.000Z"),
            }),
          }),
          include: [
            {
              model: PatientModel,
              as: "PatientModel",
              attributes: ["id", "cxId", "data"],
            },
          ],
        })
      );
      expect(res.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              id: "1",
              cxId: req.cxId,
              patientId: "patient-101",
              facilityName: "Default Facility",
              latestEvent: "Admitted",
              class: "Default Class",
              admitTime: new Date("2023-06-01"),
              dischargeTime: null,
              clinicalInformation: {},
              patientName: "Alice Brown",
              patientDateOfBirth: "1995-08-20",
              patientPhoneNumbers: ["555-9999"],
              patientStates: ["TX"],
            }),
          ]),
        })
      );
    });
  });
});
