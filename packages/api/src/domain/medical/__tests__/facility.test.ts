/* eslint-disable @typescript-eslint/no-empty-function */
import { MedicalDataSource } from "@metriport/core/external/index";
import { FacilityType } from "@metriport/core/domain/facility";
import { makeFacility } from "../../medical/__tests__/facility";
import { isFacilityActiveForHie } from "../facility";

describe("isFacilityActiveForHie", () => {
  it("throws if invalid MedicalDataSource", async () => {
    const facility = makeFacility({
      type: FacilityType.initiatorOnly,
    });
    expect(() => isFacilityActiveForHie(facility, "something" as MedicalDataSource)).toThrow();
  });

  describe("CQ", () => {
    it("returns true when CQ is active", async () => {
      const facility = makeFacility({
        type: FacilityType.initiatorOnly,
        cqActive: true,
      });
      const resp = isFacilityActiveForHie(facility, MedicalDataSource.CAREQUALITY);
      expect(resp).toBeTruthy();
    });

    it("returns false when CQ is not active", async () => {
      const facility = makeFacility({
        type: FacilityType.initiatorOnly,
        cqActive: false,
      });
      const resp = isFacilityActiveForHie(facility, MedicalDataSource.CAREQUALITY);
      expect(resp).toBeFalsy();
    });
  });

  describe("CW", () => {
    it("returns true when CW is active", async () => {
      const facility = makeFacility({
        type: FacilityType.initiatorOnly,
        cwActive: true,
      });
      const resp = isFacilityActiveForHie(facility, MedicalDataSource.COMMONWELL);
      expect(resp).toBeTruthy();
    });

    it("returns false when CW is not active", async () => {
      const facility = makeFacility({
        type: FacilityType.initiatorOnly,
        cwActive: false,
      });
      const resp = isFacilityActiveForHie(facility, MedicalDataSource.COMMONWELL);
      expect(resp).toBeFalsy();
    });
  });

  describe("EHEX", () => {
    it("returns true when EHEX is active", async () => {
      const facility = makeFacility({
        type: FacilityType.initiatorOnly,
        ehexActive: true,
      });
      const resp = isFacilityActiveForHie(facility, MedicalDataSource.EHEX);
      expect(resp).toBeTruthy();
    });

    it("returns false when EHEX is not active", async () => {
      const facility = makeFacility({
        type: FacilityType.initiatorOnly,
        ehexActive: false,
      });
      const resp = isFacilityActiveForHie(facility, MedicalDataSource.EHEX);
      expect(resp).toBeFalsy();
    });
  });
});
