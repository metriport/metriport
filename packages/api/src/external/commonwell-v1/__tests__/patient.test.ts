/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import * as featureFlags from "@metriport/core/command/feature-flags/domain-ffs";
import { makePatient } from "@metriport/core/domain/__tests__/patient";
import { Config } from "../../../shared/config";
import * as hieInitiator from "../../hie/get-hie-initiator";
import { validateCWEnabled } from "../shared";

describe("patient", () => {
  describe("validateCWEnabled", () => {
    let config_isSandbox: jest.SpyInstance<boolean, []>;
    beforeAll(() => {
      jest.restoreAllMocks();
      jest.spyOn(featureFlags, "isCommonwellEnabled").mockResolvedValue(true);
      jest.spyOn(featureFlags, "isCWEnabledForCx").mockResolvedValue(true);
      jest.spyOn(hieInitiator, "isHieEnabledToQuery").mockResolvedValue(true);
      config_isSandbox = jest.spyOn(Config, "isSandbox");
    });
    afterAll(() => {
      jest.restoreAllMocks();
    });

    it("returns true when patient has gender F", async () => {
      const facilityId = faker.string.uuid();
      const patient = makePatient({ data: { genderAtBirth: "F" } });
      const resp = await validateCWEnabled({ patient, facilityId });
      expect(resp).toEqual(true);
    });

    it("returns true when patient has gender M", async () => {
      const facilityId = faker.string.uuid();
      const patient = makePatient({ data: { genderAtBirth: "M" } });
      const resp = await validateCWEnabled({ patient, facilityId });
      expect(resp).toEqual(true);
    });

    it("returns true when patient has gender O", async () => {
      const facilityId = faker.string.uuid();
      const patient = makePatient({ data: { genderAtBirth: "O" } });
      const resp = await validateCWEnabled({ patient, facilityId });
      expect(resp).toEqual(true);
    });

    it("returns false when patient has gender U", async () => {
      const facilityId = faker.string.uuid();
      const patient = makePatient({ data: { genderAtBirth: "U" } });
      const resp = await validateCWEnabled({ patient, facilityId });
      expect(resp).toEqual(false);
    });

    it("returns false when forceCW is true and patient has gender U", async () => {
      const facilityId = faker.string.uuid();
      const patient = makePatient({ data: { genderAtBirth: "U" } });
      const resp = await validateCWEnabled({ patient, facilityId, forceCW: true });
      expect(resp).toEqual(false);
    });

    it("returns false when isSandbox is false and patient has gender U", async () => {
      const facilityId = faker.string.uuid();
      const patient = makePatient({ data: { genderAtBirth: "U" } });
      config_isSandbox.mockReturnValueOnce(false);
      const resp = await validateCWEnabled({ patient, facilityId });
      expect(resp).toEqual(false);
    });

    it("returns false when isSandbox is true and patient has gender U", async () => {
      const facilityId = faker.string.uuid();
      const patient = makePatient({ data: { genderAtBirth: "U" } });
      config_isSandbox.mockReturnValueOnce(true);
      const resp = await validateCWEnabled({ patient, facilityId });
      expect(resp).toEqual(false);
    });
  });
});
