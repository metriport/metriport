import { faker } from "@faker-js/faker";
import { upsertTcmEncounter } from "../upsert-tcm-encounter";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import { makeTcmEncounterModel } from "../../../../models/medical/__tests__/tcm-encounter";
import { TcmEncounterModel } from "../../../../models/medical/tcm-encounter";

jest.mock("../../../../models/medical/tcm-encounter");

describe("Upsert TCM Encounter Command", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockStartTransaction();
  });

  describe("upsertTcmEncounter", () => {
    function makePayload(overrides = {}) {
      return {
        id: faker.string.uuid(),
        cxId: faker.string.uuid(),
        patientId: faker.string.uuid(),
        facilityName: "Some Facility",
        latestEvent: "Admitted" as const,
        class: "Inpatient",
        clinicalInformation: {},
        ...overrides,
      };
    }

    it("creates a new TCM encounter when it doesn't exist", async () => {
      const payload = makePayload();
      const mockEncounter = makeTcmEncounterModel(payload);

      (TcmEncounterModel.findOrCreate as jest.Mock).mockResolvedValueOnce([
        mockEncounter,
        true, // wasCreated = true
      ]);

      const result = await upsertTcmEncounter(payload);

      expect(TcmEncounterModel.findOrCreate).toHaveBeenCalledWith({
        where: {
          id: payload.id,
          cxId: payload.cxId,
        },
        defaults: payload,
      });
      expect(result).toEqual(mockEncounter);
    });

    it("updates an existing TCM encounter when it exists", async () => {
      const payload = makePayload();
      const existingEncounter = makeTcmEncounterModel(payload);

      (TcmEncounterModel.findOrCreate as jest.Mock).mockResolvedValueOnce([
        existingEncounter,
        false, // wasCreated = false
      ]);

      // Mock the update method to return the same instance (Sequelize behavior)
      (existingEncounter.update as jest.Mock).mockResolvedValueOnce(existingEncounter);

      await upsertTcmEncounter(payload);

      expect(TcmEncounterModel.findOrCreate).toHaveBeenCalledWith({
        where: {
          id: payload.id,
          cxId: payload.cxId,
        },
        defaults: payload,
      });
      expect(existingEncounter.update).toHaveBeenCalledWith(payload);
    });
  });
});
