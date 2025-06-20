// At the very top, before any imports that use the model:
jest.mock("../../../models/medical/tcm-encounter", () => ({
  TcmEncounterModel: {
    create: jest.fn(),
  },
}));

import { faker } from "@faker-js/faker";
import { createTcmEncounter } from "../../../command/medical/tcm-encounter/create-tcm-encounter";
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
    function makePayload(overrides = {}) {
      return {
        cxId: faker.string.uuid(),
        patientId: faker.string.uuid(),
        facilityName: "Some Facility",
        latestEvent: "Admitted" as const,
        class: "Inpatient",
        clinicalInformation: {},
        ...overrides,
      };
    }

    it("creates a new TCM encounter", async () => {
      const payload = makePayload();
      const mockEncounter = { ...payload, id: "enc-1" };
      (TcmEncounterModel.create as jest.Mock).mockResolvedValueOnce(mockEncounter);

      const result = await createTcmEncounter(payload);

      expect(TcmEncounterModel.create).toHaveBeenCalledWith(expect.objectContaining(payload));
      expect(result).toEqual(mockEncounter);
    });

    it("handles optional fields correctly", async () => {
      const payloadWithoutOptionals = makePayload();

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
