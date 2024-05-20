import { faker } from "@faker-js/faker";
import { Facility, FacilityType } from "../../../../domain/medical/facility";
import { makeFacility } from "../../../../domain/medical/__tests__/facility";
import * as createFacility from "../create-facility";
import { validateUpdate } from "../update-facility";
import { makeFacilityUpdateCmd } from "./update-facility";

function makeValidUpdateCmd(params: Partial<Facility> = {}) {
  return makeFacilityUpdateCmd({
    cwType: FacilityType.initiatorOnly,
    cqType: FacilityType.initiatorOnly,
    cwActive: true,
    cqActive: true,
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
      updateFac.cwType = undefined;
      updateFac.cqType = undefined;
      updateFac.cqActive = undefined;
      updateFac.cwActive = undefined;
      updateFac.cqOboOid = undefined;
      updateFac.cwOboOid = undefined;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { cqType, cwType, cqActive, cwActive, cqOboOid, cwOboOid, ...updateWithoutObo } =
        updateFac;
      validateUpdate(existing, updateFac);
      expect(validateCreate_mock).toHaveBeenCalledWith({
        ...existing,
        ...updateWithoutObo,
      });
    });

    it("uses existing type when update is not present", async () => {
      const existing = makeFacility({
        cqType: FacilityType.initiatorOnly,
        cwType: FacilityType.initiatorOnly,
      });
      const updateFac = makeValidUpdateCmd();
      updateFac.cwType = undefined;
      updateFac.cqType = undefined;
      const res = validateUpdate(existing, updateFac);
      expect(res).toBeTruthy();
      expect(res).toEqual(
        expect.objectContaining({ cqType: existing.cqType, cwType: existing.cwType })
      );
    });

    it("uses existing CQ data when update is not present", async () => {
      const existing = makeFacility({ cqActive: true, cqOboOid: faker.string.uuid() });
      const updateFac = makeValidUpdateCmd();
      updateFac.cqActive = undefined;
      updateFac.cqOboOid = undefined;
      const res = validateUpdate(existing, updateFac);
      expect(res).toBeTruthy();
      expect(res).toEqual(
        expect.objectContaining({
          cqActive: existing.cqActive,
          cqOboOid: existing.cqOboOid,
        })
      );
    });

    it("uses existing CW data when update is not present", async () => {
      const existing = makeFacility({ cwActive: true, cwOboOid: faker.string.uuid() });
      const updateFac = makeValidUpdateCmd();
      updateFac.cwActive = undefined;
      updateFac.cwOboOid = undefined;
      const res = validateUpdate(existing, updateFac);
      expect(res).toBeTruthy();
      expect(res).toEqual(
        expect.objectContaining({
          cwActive: existing.cwActive,
          cwOboOid: existing.cwOboOid,
        })
      );
    });

    it("uses update cqType when provided", async () => {
      const existing = makeFacility({ cqType: FacilityType.initiatorOnly });
      const updateFac = makeFacility({ cqType: FacilityType.initiatorAndResponder });
      const res = validateUpdate(existing, updateFac);
      expect(res).toBeTruthy();
      expect(res).toEqual(expect.objectContaining({ cqType: updateFac.cqType }));
    });

    it("uses update cwType when provided", async () => {
      const existing = makeFacility({ cwType: FacilityType.initiatorOnly });
      const updateFac = makeFacility({ cwType: FacilityType.initiatorAndResponder });
      const res = validateUpdate(existing, updateFac);
      expect(res).toBeTruthy();
      expect(res).toEqual(expect.objectContaining({ cwType: updateFac.cwType }));
    });

    it("uses update CQ data when provided", async () => {
      const existing = makeFacility({ cqActive: false, cqOboOid: faker.string.uuid() });
      const updateFac = makeValidUpdateCmd({ cqActive: true, cqOboOid: faker.string.uuid() });
      const res = validateUpdate(existing, updateFac);
      expect(res).toBeTruthy();
      expect(res).toEqual(
        expect.objectContaining({
          cqActive: updateFac.cqActive,
          cqOboOid: updateFac.cqOboOid,
        })
      );
    });

    it("uses update CW data when provided", async () => {
      const existing = makeFacility({ cwActive: false, cwOboOid: faker.string.uuid() });
      const updateFac = makeValidUpdateCmd({ cwActive: true, cwOboOid: faker.string.uuid() });
      const res = validateUpdate(existing, updateFac);
      expect(res).toBeTruthy();
      expect(res).toEqual(
        expect.objectContaining({
          cwActive: updateFac.cwActive,
          cwOboOid: updateFac.cwOboOid,
        })
      );
    });
  });
});
