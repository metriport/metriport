/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { makePatient } from "../../../domain/medical/__tests__/patient";
import * as appConfig from "../../aws/app-config";
import { validateCWEnabled } from "../patient";
import * as cwShared from "../shared";

describe("patient", () => {
  describe("validateCWEnabled", () => {
    beforeAll(() => {
      jest.restoreAllMocks();
      jest.spyOn(appConfig, "isCommonwellEnabled").mockResolvedValue(true);
      jest.spyOn(appConfig, "isCWEnabledForCx").mockResolvedValue(true);
      jest.spyOn(cwShared, "isFacilityEnabledToQueryCW").mockResolvedValue(true);
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
  });
});
