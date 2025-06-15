import { faker } from "@faker-js/faker";
import { USState } from "@metriport/shared";
import * as normalizeDobFile from "@metriport/shared/domain/dob";
import { DriversLicense } from "../../../../domain/patient";
import { mapCsvDriversLicense, mapCsvPatientToMetriportPatient } from "../convert-patient";

describe("convert-patient", () => {
  describe("mapCsvPatientToMetriportPatient", () => {
    let normalizeDobSafe_mock: jest.SpyInstance;
    beforeAll(() => {
      normalizeDobSafe_mock = jest.spyOn(normalizeDobFile, "normalizeDobSafe");
    });
    afterAll(() => {
      normalizeDobSafe_mock.mockRestore();
    });

    function makeCsv(): Record<string, string | undefined> {
      return {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        dob: faker.date.birthdate().toISOString(),
        gender: faker.helpers.arrayElement(["male", "female"]),
        addressLine1: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        zip: faker.location.zipCode().slice(0, 5),
      };
    }
    it("returns patient when all fields are present", () => {
      const csv = makeCsv();
      const result = mapCsvPatientToMetriportPatient(csv);
      expect(result).toEqual(
        expect.objectContaining({
          firstName: csv.firstName,
          lastName: csv.lastName,
          dob: csv.dob?.slice(0, 10),
          genderAtBirth: csv.gender === "male" ? "M" : "F",
          address: [
            expect.objectContaining({
              addressLine1: csv.addressLine1,
              city: csv.city,
              state: csv.state,
              zip: csv.zip,
              country: "USA",
            }),
          ],
        })
      );
    });

    it("indicates missing first name", () => {
      const csv = makeCsv();
      csv.firstName = undefined;
      const result = mapCsvPatientToMetriportPatient(csv);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "firstName",
            error: "Missing firstName",
          }),
        ])
      );
    });

    it("indicates missing last name", () => {
      const csv = makeCsv();
      csv.lastName = undefined;
      const result = mapCsvPatientToMetriportPatient(csv);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "lastName",
            error: "Missing lastName",
          }),
        ])
      );
    });

    it("indicates missing dob", () => {
      const csv = makeCsv();
      csv.dob = undefined;
      const result = mapCsvPatientToMetriportPatient(csv);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "dob",
            error: "Missing/invalid dob",
          }),
        ])
      );
    });

    it("indicates missing gender", () => {
      const csv = makeCsv();
      csv.gender = undefined;
      const result = mapCsvPatientToMetriportPatient(csv);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "gender",
            error: "Missing/invalid gender",
          }),
        ])
      );
    });

    it("indicates missing address", () => {
      const csv = makeCsv();
      csv.addressLine1 = undefined;
      const result = mapCsvPatientToMetriportPatient(csv);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "address",
            error: "Missing address",
          }),
        ])
      );
    });

    it("indicates missing multiple fields", () => {
      const csv = makeCsv();
      csv.firstName = undefined;
      csv.lastName = undefined;
      csv.dob = undefined;
      csv.gender = undefined;
      const result = mapCsvPatientToMetriportPatient(csv);
      console.log(result);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "firstName",
            error: "Missing firstName",
          }),
          expect.objectContaining({
            field: "lastName",
            error: "Missing lastName",
          }),
          expect.objectContaining({
            field: "dob",
            error: "Missing/invalid dob",
          }),
          expect.objectContaining({
            field: "gender",
            error: "Missing/invalid gender",
          }),
        ])
      );
    });

    it("indicates invalid dob when dob is partial ISO date", () => {
      const csv = makeCsv();
      csv.dob = "90-01-01";
      const result = mapCsvPatientToMetriportPatient(csv);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "dob",
            error: "Missing/invalid dob",
          }),
        ])
      );
    });

    it("calls normalizeDobSafe with the dob", () => {
      const csv = makeCsv();
      mapCsvPatientToMetriportPatient(csv);
      expect(normalizeDobSafe_mock).toHaveBeenCalledWith(csv.dob);
    });
  });

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
