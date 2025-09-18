import { faker } from "@faker-js/faker";
import { toTitleCase, USState } from "@metriport/shared";
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
        firstname: toTitleCase(faker.person.firstName()),
        lastname: toTitleCase(faker.person.lastName()),
        dob: faker.date.birthdate().toISOString(),
        gender: faker.helpers.arrayElement(["male", "female"]),
        addressline1: toTitleCase(faker.location.streetAddress()),
        city: toTitleCase(faker.location.city()),
        state: faker.location.state({ abbreviated: true }),
        zip: faker.location.zipCode().slice(0, 5),
      };
    }

    it("returns patient when all fields are present", () => {
      const csv = makeCsv();
      const result = mapCsvPatientToMetriportPatient(csv);
      expect(result).toEqual(
        expect.objectContaining({
          firstName: csv.firstname,
          lastName: csv.lastname,
          dob: csv.dob?.slice(0, 10),
          genderAtBirth: csv.gender === "male" ? "M" : "F",
          address: [
            expect.objectContaining({
              addressLine1: csv.addressline1,
              city: csv.city,
              state: csv.state,
              zip: csv.zip,
              country: "USA",
            }),
          ],
        })
      );
    });

    it("keeps words with original capitalization", () => {
      const csv = makeCsv();
      csv.firstname = "John O'Connor";
      csv.lastname = "FrommageTheThird";
      csv.addressline1 = "123 VanBuren St";
      csv.addressline2 = "ApT 999";
      const result = mapCsvPatientToMetriportPatient(csv);
      expect(result).toEqual(
        expect.objectContaining({
          firstName: csv.firstname,
          lastName: csv.lastname,
          dob: csv.dob?.slice(0, 10),
          genderAtBirth: csv.gender === "male" ? "M" : "F",
          address: [
            expect.objectContaining({
              addressLine1: csv.addressline1,
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
      csv.firstname = undefined;
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
      csv.lastname = undefined;
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
      csv.addressline1 = undefined;
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
      csv.firstname = undefined;
      csv.lastname = undefined;
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

    describe("value field name variations", () => {
      const valueFieldNames = [
        "driverslicense",
        "driverslicence",
        "driverslicensevalue",
        "driverslicencevalue",
        "driverslicensenumber",
        "driverslicencenumber",
        "driverslicenseno",
        "driverslicenceno",
      ];
      for (const valueFieldName of valueFieldNames) {
        it("returns drivers license when all fields name is " + valueFieldName, () => {
          const value = faker.number.int({ min: 100_000_000, max: 999_999_999 }).toString();
          const state = faker.helpers.arrayElement(Object.values(USState));
          const { driversLicense, errors } = mapCsvDriversLicense({
            [valueFieldName]: value,
            driverslicensestate: state,
          });
          expect(driversLicense).toBeTruthy();
          expect(driversLicense?.type).toBe("driversLicense");
          const dl = driversLicense as DriversLicense;
          expect(dl.value).toBe(value);
          expect(dl.state).toBe(state);
          expect(errors).toEqual([]);
        });
      }
    });

    describe("state field name variations", () => {
      const stateFieldNames = ["driverslicensestate", "driverslicencestate"];
      for (const stateFieldName of stateFieldNames) {
        it("returns drivers license when all fields name is " + stateFieldName, () => {
          const value = faker.number.int({ min: 100_000_000, max: 999_999_999 }).toString();
          const state = faker.helpers.arrayElement(Object.values(USState));
          const { driversLicense, errors } = mapCsvDriversLicense({
            [stateFieldName]: state,
            driverslicenceno: value,
          });
          expect(driversLicense).toBeTruthy();
          expect(driversLicense?.type).toBe("driversLicense");
          const dl = driversLicense as DriversLicense;
          expect(dl.value).toBe(value);
          expect(dl.state).toBe(state);
          expect(errors).toEqual([]);
        });
      }
    });
  });
});
