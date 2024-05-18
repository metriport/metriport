/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { MedicalDataSource } from "@metriport/core/external/index";
import { makeFacility } from "./facility";
import { FacilityType, isOboEnabled } from "../facility";

describe("isOboEnabled", () => {
  it("throws if invalid MedicalDataSource", async () => {
    const facility = makeFacility({ type: FacilityType.initiatorOnly });
    expect(() => isOboEnabled(facility, "something" as MedicalDataSource)).toThrow();
  });

  describe("CQ", () => {
    it("returns true when obo is active, has oid, and is initiator only", async () => {
      const facility = makeFacility({
        type: FacilityType.initiatorOnly,
        cqOboActive: true,
        cqOboOid: faker.string.uuid(),
      });
      const resp = isOboEnabled(facility, MedicalDataSource.CAREQUALITY);
      expect(resp).toBeTruthy();
    });

    it("returns false when obo is active, does not have oid, and is initiator only", async () => {
      const facility = makeFacility({
        type: FacilityType.initiatorOnly,
        cqOboActive: true,
        cqOboOid: null,
      });
      const resp = isOboEnabled(facility, MedicalDataSource.CAREQUALITY);
      expect(resp).toBeFalsy();
    });

    it("returns false when obo is not active, has oid, and is initiator only", async () => {
      const facility = makeFacility({
        type: FacilityType.initiatorOnly,
        cqOboActive: false,
        cqOboOid: faker.string.uuid(),
      });
      const resp = isOboEnabled(facility, MedicalDataSource.CAREQUALITY);
      expect(resp).toBeFalsy();
    });

    it("returns false when obo is active, has oid, but its not initiator only", async () => {
      const facility = makeFacility({
        type: FacilityType.initiatorAndResponder,
        cqOboActive: true,
        cqOboOid: faker.string.uuid(),
      });
      const resp = isOboEnabled(facility, MedicalDataSource.CAREQUALITY);
      expect(resp).toBeFalsy();
    });
  });

  describe("CW", () => {
    it("returns true when obo is active, has oid, and is initiator only", async () => {
      const facility = makeFacility({
        type: FacilityType.initiatorOnly,
        cwOboActive: true,
        cwOboOid: faker.string.uuid(),
      });
      const resp = isOboEnabled(facility, MedicalDataSource.COMMONWELL);
      expect(resp).toBeTruthy();
    });

    it("returns false when obo is active, does not have oid, and is initiator only", async () => {
      const facility = makeFacility({
        type: FacilityType.initiatorOnly,
        cwOboActive: true,
        cwOboOid: null,
      });
      const resp = isOboEnabled(facility, MedicalDataSource.COMMONWELL);
      expect(resp).toBeFalsy();
    });

    it("returns false when obo is not active, has oid, and is initiator only", async () => {
      const facility = makeFacility({
        type: FacilityType.initiatorOnly,
        cwOboActive: false,
        cwOboOid: faker.string.uuid(),
      });
      const resp = isOboEnabled(facility, MedicalDataSource.COMMONWELL);
      expect(resp).toBeFalsy();
    });

    it("returns false when obo is active, has oid, but its not initiator only", async () => {
      const facility = makeFacility({
        type: FacilityType.initiatorAndResponder,
        cwOboActive: true,
        cwOboOid: faker.string.uuid(),
      });
      const resp = isOboEnabled(facility, MedicalDataSource.COMMONWELL);
      expect(resp).toBeFalsy();
    });
  });
});
