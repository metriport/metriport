// At the very top, before any imports that use the model:
jest.mock("../../../models/medical/tcm-encounter", () => ({
  TcmEncounterModel: {
    create: jest.fn(),
  },
}));

import { faker } from "@faker-js/faker";
import { Request, Response } from "express";
import httpStatus from "http-status";
import { ZodError } from "zod";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { makeTcmEncounterModel } from "../../../models/medical/__tests__/tcm-encounter";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import {
  TcmEncounterCreateInput,
  tcmEncounterCreateSchema,
} from "../../medical/schemas/tcm-encounter";
import { createTcmEncounter } from "../medical/tcm-encounter";

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
    const validCreatePayload: TcmEncounterCreateInput = {
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
        ...validCreatePayload,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        admitTime: new Date(validCreatePayload.admitTime!),
        dischargeTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (TcmEncounterModel.create as jest.Mock).mockResolvedValueOnce(mockEncounter);

      await createTcmEncounter(req, res);

      expect(TcmEncounterModel.create).toHaveBeenCalledWith({
        id: expect.any(String),
        ...tcmEncounterCreateSchema.parse(validCreatePayload),
      });
      expect(res.status).toHaveBeenCalledWith(httpStatus.CREATED);
      expect(res.json).toHaveBeenCalledWith(mockEncounter);
    });

    it("validates required fields", async () => {
      const invalidCreatePayload = {
        ...validCreatePayload,
        cxId: undefined,
      };

      const req = mockRequest(invalidCreatePayload);
      const res = mockResponse();

      await expect(createTcmEncounter(req, res)).rejects.toThrow(ZodError);
    });
  });
});
