import { buildDayjs } from "@metriport/shared/common/date";
import { makeAddressStrict } from "../../../../domain/medical/__tests__/location-address";
import { makePatientCreate } from "../../../../domain/medical/__tests__/patient";
import { validate } from "../shared";

describe("validate", () => {
  it("returns true when patient is valid", async () => {
    const patient = makePatientCreate();
    const resp = validate(patient);
    expect(resp).toBeTruthy();
  });

  describe("address", () => {
    it("returns false if address is empty", async () => {
      const patient = makePatientCreate({ address: [] });
      const resp = validate(patient);
      expect(resp).toBeFalsy();
    });

    it("returns false if address is undefined", async () => {
      const patient = makePatientCreate();
      patient.address = undefined as unknown as any; //eslint-disable-line @typescript-eslint/no-explicit-any
      const resp = validate(patient);
      expect(resp).toBeFalsy();
    });

    it("returns true if address has one element", async () => {
      const patient = makePatientCreate({ address: [makeAddressStrict()] });
      const resp = validate(patient);
      expect(resp).toBeTruthy();
    });

    it("returns true if address has multiple elements", async () => {
      const patient = makePatientCreate({
        address: [makeAddressStrict(), makeAddressStrict(), makeAddressStrict()],
      });
      const resp = validate(patient);
      expect(resp).toBeTruthy();
    });
  });

  describe("dob", () => {
    it("throws an error if dob is in the future", async () => {
      const futureDate = buildDayjs().add(1, "day").format("YYYY-MM-DD");
      const patient = makePatientCreate({ dob: futureDate });
      expect(() => validate(patient)).toThrow(`Invalid date of birth`);
    });

    it("throws an error when dob is an hour in the future", async () => {
      const futureDate = buildDayjs().add(1, "hour").toISOString();
      const patient = makePatientCreate({ dob: futureDate });
      expect(() => validate(patient)).toThrow(`Invalid date of birth`);
    });

    it("returns true when dob is the current date", async () => {
      const currentDate = buildDayjs().format("YYYY-MM-DD");
      const patient = makePatientCreate({ dob: currentDate });
      const resp = validate(patient);
      expect(resp).toBeTruthy();
    });

    it("returns true when dob is in the past", async () => {
      const pastDate = buildDayjs().subtract(1, "day").format("YYYY-MM-DD");
      const patient = makePatientCreate({ dob: pastDate });
      const resp = validate(patient);
      expect(resp).toBeTruthy();
    });
  });
});
