import { faker } from "@faker-js/faker";
import { Facility, FacilityType } from "../../../../domain/medical/facility";
import { makeFacility } from "../../../../domain/medical/__tests__/facility";
import * as createFacility from "../create-facility";
import { validateUpdate } from "../update-facility";
import { makeFacilityUpdateCmd } from "./update-facility.test";

function makeValidUpdateCmd(params: Partial<Facility> = {}) {
  return makeFacilityUpdateCmd({
    type: FacilityType.initiatorOnly,
    cwOboActive: true,
    cqOboActive: true,
    ...params,
  });
}

describe("updateFacility", () => {
  describe("validate", () => {
    let validateCreate_mock: jest.SpyInstance;
    beforeAll(() => {
      jest.restoreAllMocks();
      validateCreate_mock = jest.spyOn(createFacility, "validateCreate").mockReturnValue(true);
    });
    afterEach(() => {
      jest.resetAllMocks();
    });

    it("calls validateCreate", async () => {
      const existing = makeFacility();
      const updateFac = makeValidUpdateCmd();
      updateFac.type = undefined;
      updateFac.cqOboActive = undefined;
      updateFac.cwOboActive = undefined;
      updateFac.cqOboOid = undefined;
      updateFac.cwOboOid = undefined;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { type, cqOboActive, cwOboActive, cqOboOid, cwOboOid, ...updateWithoutObo } = updateFac;
      validateUpdate(existing, updateFac);
      expect(validateCreate_mock).toHaveBeenCalledWith({
        ...existing,
        ...updateWithoutObo,
      });
    });

    it("uses existing type when update is not present", async () => {
      const existing = makeFacility({ type: FacilityType.initiatorOnly });
      const updateFac = makeValidUpdateCmd();
      updateFac.type = undefined;
      const res = validateUpdate(existing, updateFac);
      expect(res).toBeTruthy();
      expect(res).toEqual(expect.objectContaining({ type: existing.type }));
    });

    it("uses existing CQ data when update is not present", async () => {
      const existing = makeFacility({ cqOboActive: true, cqOboOid: faker.string.uuid() });
      const updateFac = makeValidUpdateCmd();
      updateFac.cqOboActive = undefined;
      updateFac.cqOboOid = undefined;
      const res = validateUpdate(existing, updateFac);
      expect(res).toBeTruthy();
      expect(res).toEqual(
        expect.objectContaining({
          cqOboActive: existing.cqOboActive,
          cqOboOid: existing.cqOboOid,
        })
      );
    });

    it("uses existing CW data when update is not present", async () => {
      const existing = makeFacility({ cwOboActive: true, cwOboOid: faker.string.uuid() });
      const updateFac = makeValidUpdateCmd();
      updateFac.cwOboActive = undefined;
      updateFac.cwOboOid = undefined;
      const res = validateUpdate(existing, updateFac);
      expect(res).toBeTruthy();
      expect(res).toEqual(
        expect.objectContaining({
          cwOboActive: existing.cwOboActive,
          cwOboOid: existing.cwOboOid,
        })
      );
    });

    it("uses update type when provided", async () => {
      const existing = makeFacility({ type: FacilityType.initiatorOnly });
      const updateFac = makeFacility({ type: FacilityType.initiatorAndResponder });
      const res = validateUpdate(existing, updateFac);
      expect(res).toBeTruthy();
      expect(res).toEqual(expect.objectContaining({ type: updateFac.type }));
    });

    it("uses update CQ data when provided", async () => {
      const existing = makeFacility({ cqOboActive: false, cqOboOid: faker.string.uuid() });
      const updateFac = makeValidUpdateCmd({ cqOboActive: true, cqOboOid: faker.string.uuid() });
      const res = validateUpdate(existing, updateFac);
      expect(res).toBeTruthy();
      expect(res).toEqual(
        expect.objectContaining({
          cqOboActive: updateFac.cqOboActive,
          cqOboOid: updateFac.cqOboOid,
        })
      );
    });

    it("uses update CW data when provided", async () => {
      const existing = makeFacility({ cwOboActive: false, cwOboOid: faker.string.uuid() });
      const updateFac = makeValidUpdateCmd({ cwOboActive: true, cwOboOid: faker.string.uuid() });
      const res = validateUpdate(existing, updateFac);
      expect(res).toBeTruthy();
      expect(res).toEqual(
        expect.objectContaining({
          cwOboActive: updateFac.cwOboActive,
          cwOboOid: updateFac.cwOboOid,
        })
      );
    });
  });
});
