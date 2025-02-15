import { USState } from "@metriport/shared";
import { DriversLicense } from "../../../../domain/patient";
import { mapCsvDriversLicense } from "../convert-patient";

describe("convert-patient", () => {
  describe("mapCsvDriversLicense", () => {
    it("returns drivers license when all fields are present", () => {
      const { driversLicense, errors } = mapCsvDriversLicense({
        driverslicenceno: "123456789",
        driverslicencestate: "CA",
      });
      expect(driversLicense).toBeTruthy();
      expect(driversLicense?.type).toBe("driversLicense");
      const dl = driversLicense as DriversLicense;
      expect(dl.value).toBe("123456789");
      expect(dl.state).toBe(USState.CA);
      expect(errors).toEqual([]);
    });

    it("returns error when value is present but state is missing", () => {
      const { driversLicense, errors } = mapCsvDriversLicense({
        driverslicenceno: "123456789",
      });
      expect(driversLicense).toBeUndefined();
      expect(errors).toEqual([
        { field: "driversLicense", error: "Invalid drivers license (missing state)" },
      ]);
    });

    it("returns error when state is present but value is missing", () => {
      const { driversLicense, errors } = mapCsvDriversLicense({
        driverslicencestate: "CA",
      });
      expect(driversLicense).toBeUndefined();
      expect(errors).toEqual([
        { field: "driversLicense", error: "Invalid drivers license (missing value)" },
      ]);
    });

    it("returns error when state is present and value is invalid", () => {
      const { driversLicense, errors } = mapCsvDriversLicense({
        driverslicenceno: "",
        driverslicencestate: "CA",
      });
      expect(driversLicense).toBeUndefined();
      expect(errors).toEqual([
        { field: "driversLicense", error: "Invalid drivers license (missing value)" },
      ]);
    });

    it("returns undefined when value is present and state is invalid", () => {
      const { driversLicense, errors } = mapCsvDriversLicense({
        driverslicencestate: "zz",
      });
      expect(driversLicense).toBeUndefined();
      expect(errors).toEqual([]);
    });

    it("returns error when value is present and state is invalid", () => {
      const { driversLicense, errors } = mapCsvDriversLicense({
        driverslicenceno: "123456789",
        driverslicencestate: "zz",
      });
      expect(driversLicense).toBeUndefined();
      expect(errors).toEqual([
        { field: "driversLicense", error: "Invalid drivers license (missing state)" },
      ]);
    });

    it("returns undefined when no fields are present", () => {
      const { driversLicense, errors } = mapCsvDriversLicense({});
      expect(driversLicense).toBeUndefined();
      expect(errors).toEqual([]);
    });

    it("returns undefined when both are invalid", () => {
      const { driversLicense, errors } = mapCsvDriversLicense({
        driverslicenceno: "",
        driverslicencestate: "zz",
      });
      expect(driversLicense).toBeUndefined();
      expect(errors).toEqual([]);
    });
  });
});
