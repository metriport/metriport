import { USState } from "@metriport/shared";
import { DriversLicense } from "../../../../domain/patient";
import { mapCsvDriversLicense } from "../convert-patient";

describe("convert-patient", () => {
  describe("mapCsvDriversLicense", () => {
    it("returns drivers license when all fields are present", () => {
      const res = mapCsvDriversLicense({
        driverslicenceno: "123456789",
        driverslicencestate: "CA",
      });
      expect(res).toBeTruthy();
      expect(res?.type).toBe("driversLicense");
      const dl = res as DriversLicense;
      expect(dl.value).toBe("123456789");
      expect(dl.state).toBe(USState.CA);
    });

    it("throws when value is present but state is missing", () => {
      expect(() =>
        mapCsvDriversLicense({
          driverslicenceno: "123456789",
        })
      ).toThrow("Invalid drivers license, missing state");
    });

    it("throws when state is present but value is missing", () => {
      expect(() =>
        mapCsvDriversLicense({
          driverslicencestate: "CA",
        })
      ).toThrow("Invalid drivers license, missing value");
    });

    it("throws when state is present and value is invalid", () => {
      expect(() =>
        mapCsvDriversLicense({
          driverslicenceno: "",
          driverslicencestate: "CA",
        })
      ).toThrow("Invalid drivers license, missing value");
    });

    it("returns undefined value is present and state is invalid", () => {
      const res = mapCsvDriversLicense({
        driverslicencestate: "zz",
      });
      expect(res).toBeUndefined();
    });

    it("throws when value is present and state is invalid", () => {
      expect(() =>
        mapCsvDriversLicense({
          driverslicenceno: "123456789",
          driverslicencestate: "zz",
        })
      ).toThrow("Invalid drivers license, missing state");
    });

    it("returns undefined when no fields are present", () => {
      const res = mapCsvDriversLicense({});
      expect(res).toBeUndefined();
    });

    it("returns undefined when both are invalid", () => {
      const res = mapCsvDriversLicense({
        driverslicenceno: "",
        driverslicencestate: "zz",
      });
      expect(res).toBeUndefined();
    });
  });
});
