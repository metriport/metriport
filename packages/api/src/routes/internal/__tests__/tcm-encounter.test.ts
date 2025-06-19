// At the very top, before any imports that use the model:
jest.mock("../../../models/medical/tcm-encounter", () => ({
  TcmEncounterModel: {
    create: jest.fn(),
  },
}));

import { faker } from "@faker-js/faker";
import {
  createTcmEncounter,
  CreateTcmEncounter,
} from "../../../command/medical/tcm-encounter/create-tcm-encounter";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { makeTcmEncounterModel } from "../../../models/medical/__tests__/tcm-encounter";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";

describe("Create TCM Encounter Command", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockStartTransaction();
  });

  describe("createTcmEncounter", () => {
    const validCreatePayload: CreateTcmEncounter = {
      cxId: faker.string.uuid(),
      patientId: faker.string.uuid(),
      facilityName: faker.company.name(),
      latestEvent: "Admitted",
      class: "Inpatient",
      admitTime: faker.date.recent(),
      dischargeTime: null,
      clinicalInformation: { test: "data" },
    };

    it("creates a new TCM encounter", async () => {
      const mockEncounter = makeTcmEncounterModel({
        id: faker.string.uuid(),
        ...validCreatePayload,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        admitTime: validCreatePayload.admitTime!,
        dischargeTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (TcmEncounterModel.create as jest.Mock).mockResolvedValueOnce(mockEncounter);

      const result = await createTcmEncounter(validCreatePayload);

      expect(TcmEncounterModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cxId: validCreatePayload.cxId,
          patientId: validCreatePayload.patientId,
          facilityName: validCreatePayload.facilityName,
          latestEvent: validCreatePayload.latestEvent,
          class: validCreatePayload.class,
          admitTime: validCreatePayload.admitTime,
          dischargeTime: validCreatePayload.dischargeTime,
          clinicalInformation: validCreatePayload.clinicalInformation,
        })
      );
      expect(result).toEqual(mockEncounter);
    });

    it("handles optional fields correctly", async () => {
      const payloadWithoutOptionals: CreateTcmEncounter = {
        cxId: faker.string.uuid(),
        patientId: faker.string.uuid(),
        facilityName: faker.company.name(),
        latestEvent: "Admitted",
        class: "Inpatient",
        clinicalInformation: {},
      };

      const mockEncounter = makeTcmEncounterModel({
        id: faker.string.uuid(),
        ...payloadWithoutOptionals,
        admitTime: undefined,
        dischargeTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (TcmEncounterModel.create as jest.Mock).mockResolvedValueOnce(mockEncounter);

      const result = await createTcmEncounter(payloadWithoutOptionals);

      expect(TcmEncounterModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cxId: payloadWithoutOptionals.cxId,
          patientId: payloadWithoutOptionals.patientId,
          facilityName: payloadWithoutOptionals.facilityName,
          latestEvent: payloadWithoutOptionals.latestEvent,
          class: payloadWithoutOptionals.class,
          clinicalInformation: payloadWithoutOptionals.clinicalInformation,
        })
      );
      expect(result).toEqual(mockEncounter);
    });
  });
});
