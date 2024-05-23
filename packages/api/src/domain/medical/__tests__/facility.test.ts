/* eslint-disable @typescript-eslint/no-empty-function */
import { MedicalDataSource } from "@metriport/core/external/index";
import { makeFacility } from "../../medical/__tests__/facility";
import { FacilityType, isFacilityActiveForHie } from "../facility";

describe("isFacilityActiveForHie", () => {
  it("throws if invalid MedicalDataSource", async () => {
    const facility = makeFacility({
      cqType: FacilityType.initiatorOnly,
      cwType: FacilityType.initiatorOnly,
    });
    expect(() => isFacilityActiveForHie(facility, "something" as MedicalDataSource)).toThrow();
  });

  describe("CQ", () => {
    it("returns true when obo is active", async () => {
      const facility = makeFacility({
        cqType: FacilityType.initiatorOnly,
        cqActive: true,
      });
      const resp = isFacilityActiveForHie(facility, MedicalDataSource.CAREQUALITY);
      expect(resp).toBeTruthy();
    });

    it("returns false when obo is not active", async () => {
      const facility = makeFacility({
        cqType: FacilityType.initiatorOnly,
        cqActive: false,
      });
      const resp = isFacilityActiveForHie(facility, MedicalDataSource.CAREQUALITY);
      expect(resp).toBeFalsy();
    });
  });

  describe("CW", () => {
    it("returns true when obo is active", async () => {
      const facility = makeFacility({
        cwType: FacilityType.initiatorOnly,
        cwActive: true,
      });
      const resp = isFacilityActiveForHie(facility, MedicalDataSource.COMMONWELL);
      expect(resp).toBeTruthy();
    });

    it("returns false when obo is not active", async () => {
      const facility = makeFacility({
        cwType: FacilityType.initiatorOnly,
        cwActive: false,
      });
      const resp = isFacilityActiveForHie(facility, MedicalDataSource.COMMONWELL);
      expect(resp).toBeFalsy();
    });
  });
});
