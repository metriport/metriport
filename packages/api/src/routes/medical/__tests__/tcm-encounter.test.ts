import { Request, Response } from "express";
import httpStatus from "http-status";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { updateTcmEncounter, listTcmEncounters } from "../tcm-encounter";

jest.mock("../../../models/medical/tcm-encounter");

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

  describe("updateTcmEncounter", () => {
    it("updates an existing TCM encounter", async () => {
      const encounter = { id: req.params?.id, cxId: req.cxId };
      (TcmEncounterModel.findByPk as jest.Mock).mockResolvedValue(encounter);
      (TcmEncounterModel.update as jest.Mock).mockResolvedValue([1]);

      await updateTcmEncounter(req as Request, res as Response);

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

      await updateTcmEncounter(req as Request, res as Response);

      expect(TcmEncounterModel.findByPk).toHaveBeenCalledWith(req.params?.id);
      expect(res.status).toHaveBeenCalledWith(httpStatus.NOT_FOUND);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `TCM encounter with ID ${req.params?.id} not found`,
        })
      );
    });
  });

  describe("listTcmEncounters", () => {
    it("returns list of encounters with default filters", async () => {
      const sampleEncounter = {
        id: "1",
        patientId: "patient1",
        facilityName: "Facility A",
        latestEvent: "Admitted",
        class: "Class A",
        admitTime: new Date("2023-01-01"),
        dischargeTime: null,
        clinicalInformation: {},
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

      await listTcmEncounters(req, res);

      const expectedQuery = {
        where: {
          cxId: "cx123",
          admitTime: {
            [Symbol.for("gt")]: new Date("2020-01-01T00:00:00.000Z"),
          },
        },
        order: [["admitTime", "DESC"]], // Most recent encounters first
      };

      expect(TcmEncounterModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining(expectedQuery)
      );
      expect(res.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({
        items: mockEncounters,
        meta: {
          itemsInTotal: 1,
          itemsOnPage: 1,
        },
      });
    });

    it("handles pagination with page size of 1 and two items", async () => {
      const firstPage = [
        {
          id: "1",
          patientId: "patient1",
          facilityName: "Facility A",
          latestEvent: "Admitted",
          class: "Class A",
          admitTime: new Date("2023-01-01"),
          dischargeTime: null,
          clinicalInformation: {},
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

      await listTcmEncounters(req, res);

      expect(res.json).toHaveBeenCalledWith({
        items: firstPage,
        meta: {
          itemsInTotal: total,
          itemsOnPage: pageLimit,
        },
      });
    });

    it("filters by after date", async () => {
      req.query = { after: "2025-06-17T19:52:55.461Z" };
      const encounters = [{ id: "1", cxId: req.cxId }];
      (TcmEncounterModel.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: encounters,
        count: 1,
      });

      await listTcmEncounters(req as Request, res as Response);

      expect(TcmEncounterModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cxId: req.cxId,
            admitTime: expect.objectContaining({
              [Symbol.for("gt")]: new Date(req.query.after as string),
            }),
          }),
        })
      );
      expect(res.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ items: encounters }));
    });

    it("applies default filter for admit time > 2020", async () => {
      const encounters = [{ id: "1", cxId: req.cxId }];
      (TcmEncounterModel.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: encounters,
        count: 1,
      });

      await listTcmEncounters(req as Request, res as Response);

      expect(TcmEncounterModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cxId: req.cxId,
            admitTime: expect.objectContaining({
              [Symbol.for("gt")]: new Date("2020-01-01T00:00:00.000Z"),
            }),
          }),
        })
      );
      expect(res.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ items: encounters }));
    });
  });
});
