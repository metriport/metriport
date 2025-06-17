import { faker } from "@faker-js/faker";
import { Request, Response } from "express";
import httpStatus from "http-status";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { makeTcmEncounterModel } from "../../../models/medical/__tests__/tcm-encounter";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { TcmEncounterCreate } from "../../medical/schemas/tcm-encounter";

jest.mock("../../../models/medical/tcm-encounter");

describe("Internal TCM Encounter Routes", () => {
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

  describe("POST /internal/tcm/encounter", () => {
    const validCreatePayload: TcmEncounterCreate = {
      patientId: faker.string.uuid(),
      facilityName: faker.company.name(),
      latestEvent: "Admitted",
      class: "Inpatient",
      admitTime: faker.date.recent().toISOString(),
      dischargeTime: null,
      clinicalInformation: { test: "data" },
    };

    it("creates a new TCM encounter", async () => {
      const req = mockRequest(validCreatePayload);
      const res = mockResponse();

      const mockEncounter = makeTcmEncounterModel({
        id: faker.string.uuid(),
        cxId: req.cxId,
        ...validCreatePayload,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (TcmEncounterModel.create as jest.Mock).mockResolvedValueOnce(mockEncounter);

      // TODO: Call the route handler
      // await createTcmEncounter(req, res);

      expect(TcmEncounterModel.create).toHaveBeenCalledWith({
        cxId: req.cxId,
        ...validCreatePayload,
      });
      expect(res.status).toHaveBeenCalledWith(httpStatus.CREATED);
      expect(res.json).toHaveBeenCalledWith(mockEncounter);
    });

    it("validates required fields", async () => {
      // TODO: Remove these ESLint disable comments once the handler calls are implemented
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const req = mockRequest({});
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const res = mockResponse();

      // TODO: Call the route handler
      // await createTcmEncounter(req, res);

      expect(res.status).toHaveBeenCalledWith(httpStatus.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Required"),
        })
      );
    });
  });
});
