import { faker } from "@faker-js/faker";
import { Request, Response } from "express";
import httpStatus from "http-status";
import { Op } from "sequelize";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { makeTcmEncounterModel } from "../../../models/medical/__tests__/tcm-encounter";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { TcmEncounterUpdate } from "../schemas/tcm-encounter";

jest.mock("../../../models/medical/tcm-encounter");

describe("TCM Encounter Routes", () => {
  const mockRequest = (
    body?: unknown,
    params?: Record<string, string>,
    query?: Record<string, string>
  ) => {
    return {
      body,
      params,
      query,
      cxId: faker.string.uuid(),
    } as Request;
  };

  const mockResponse = () => {
    const res = {} as Response;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockStartTransaction();
  });

  describe("PUT /dash-oss/medical/v1/tcm/encounter/:id", () => {
    const validUpdatePayload: TcmEncounterUpdate = {
      latestEvent: "Discharged",
      dischargeTime: faker.date.recent().toISOString(),
    };

    it("updates an existing TCM encounter", async () => {
      const encounterId = faker.string.uuid();
      const req = mockRequest(validUpdatePayload, { id: encounterId });
      const res = mockResponse();

      const mockEncounter = makeTcmEncounterModel({
        id: encounterId,
        cxId: req.cxId,
        patientId: faker.string.uuid(),
        facilityName: faker.company.name(),
        latestEvent: "Discharged",
        class: "Inpatient",
        admitTime: faker.date.recent().toISOString(),
        dischargeTime: validUpdatePayload.dischargeTime,
        clinicalInformation: { test: "data" },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (TcmEncounterModel.findByPk as jest.Mock).mockResolvedValueOnce(mockEncounter);
      (TcmEncounterModel.update as jest.Mock).mockResolvedValueOnce([1]);

      // TODO: Call the route handler
      // await updateTcmEncounter(req, res);

      expect(TcmEncounterModel.findByPk).toHaveBeenCalledWith(encounterId);
      expect(TcmEncounterModel.update).toHaveBeenCalledWith(
        {
          ...validUpdatePayload,
        },
        {
          where: {
            id: encounterId,
            cxId: req.cxId,
          },
        }
      );
      expect(res.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(mockEncounter);
    });

    it("returns 404 for non-existent encounter", async () => {
      const encounterId = faker.string.uuid();
      // TODO: Remove these ESLint disable comments once the handler calls are implemented
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const req = mockRequest(validUpdatePayload, { id: encounterId });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const res = mockResponse();

      (TcmEncounterModel.findByPk as jest.Mock).mockResolvedValueOnce(null);

      // TODO: Call the route handler
      // await updateTcmEncounter(req, res);

      expect(TcmEncounterModel.findByPk).toHaveBeenCalledWith(encounterId);
      expect(res.status).toHaveBeenCalledWith(httpStatus.NOT_FOUND);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("not found"),
        })
      );
    });
  });

  describe("GET /dash-oss/medical/v1/tcm/encounter", () => {
    it("returns paginated list of encounters", async () => {
      const req = mockRequest(undefined, undefined, { count: "10" });
      const res = mockResponse();

      const mockEncounters = Array.from({ length: 10 }, () =>
        makeTcmEncounterModel({
          id: faker.string.uuid(),
          cxId: req.cxId,
          patientId: faker.string.uuid(),
          facilityName: faker.company.name(),
          latestEvent: "Admitted",
          class: "Inpatient",
          admitTime: faker.date.recent().toISOString(),
          dischargeTime: null,
          clinicalInformation: { test: "data" },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      (TcmEncounterModel.findAndCountAll as jest.Mock).mockResolvedValueOnce({
        rows: mockEncounters,
        count: 10,
      });

      // TODO: Call the route handler
      // await listTcmEncounters(req, res);

      expect(TcmEncounterModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cxId: req.cxId,
            admitTime: expect.any(Object), // Should include the > 2020 filter
          }),
          limit: 11, // One extra to determine if there's a next page
          offset: 0,
        })
      );
      expect(res.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          items: mockEncounters.slice(0, 10),
          meta: expect.objectContaining({
            itemsOnPage: 10,
            totalItems: 10,
          }),
        })
      );
    });

    it("filters by after date", async () => {
      const afterDate = faker.date.recent().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const req = mockRequest(undefined, undefined, { after: afterDate });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const res = mockResponse();

      // TODO: Call the route handler
      // await listTcmEncounters(req, res);

      expect(TcmEncounterModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cxId: req.cxId,
            admitTime: expect.objectContaining({
              [Op.gt]: afterDate,
            }),
          }),
        })
      );
    });

    it("applies default filter for admit time > 2020", async () => {
      const req = mockRequest();

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const res = mockResponse();

      // TODO: Call the route handler
      // await listTcmEncounters(req, res);

      expect(TcmEncounterModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cxId: req.cxId,
            admitTime: expect.objectContaining({
              [Op.gt]: "2020-01-01T00:00:00.000Z",
            }),
          }),
        })
      );
    });
  });
});
