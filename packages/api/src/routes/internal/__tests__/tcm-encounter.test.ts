import { faker } from "@faker-js/faker";
import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { makeTcmEncounterModel } from "../../../models/medical/__tests__/tcm-encounter";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { TcmEncounterCreate } from "../../medical/schemas/tcm-encounter";
import router from "../medical/tcm-encounter";

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

  const mockNext: NextFunction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockStartTransaction();
  });

  describe("POST /internal/tcm/encounter", () => {
    const validCreatePayload: TcmEncounterCreate = {
      cxId: faker.string.uuid(),
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
        cxId: validCreatePayload.cxId,
        patientId: validCreatePayload.patientId,
        facilityName: validCreatePayload.facilityName,
        latestEvent: validCreatePayload.latestEvent,
        class: validCreatePayload.class,
        admitTime: new Date(validCreatePayload.admitTime),
        dischargeTime: null,
        clinicalInformation: validCreatePayload.clinicalInformation,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (TcmEncounterModel.create as jest.Mock).mockResolvedValueOnce(mockEncounter);

      const route = router.stack.find(layer => layer.route?.path === "/");
      const handler = route?.route?.stack[0].handle;

      await handler(req, res, mockNext);

      expect(TcmEncounterModel.create).toHaveBeenCalledWith({
        id: expect.any(String),
        cxId: validCreatePayload.cxId,
        patientId: validCreatePayload.patientId,
        facilityName: validCreatePayload.facilityName,
        latestEvent: validCreatePayload.latestEvent,
        class: validCreatePayload.class,
        admitTime: expect.any(Date),
        dischargeTime: null,
        clinicalInformation: validCreatePayload.clinicalInformation,
      });
      expect(res.status).toHaveBeenCalledWith(httpStatus.CREATED);
      expect(res.json).toHaveBeenCalledWith(mockEncounter);
    });

    it("validates required fields", async () => {
      const req = mockRequest({});
      const res = mockResponse();

      // Get the route handler from the router stack
      const route = router.stack.find(layer => layer.route?.path === "/");
      const handler = route?.route?.stack[0].handle;

      await handler(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(httpStatus.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Required"),
        })
      );
    });
  });
});
