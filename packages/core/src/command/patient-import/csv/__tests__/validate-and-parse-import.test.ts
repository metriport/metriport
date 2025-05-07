import { makePatientPayload } from "../../steps/__tests__/patient-import";
import * as convertPatient from "../convert-patient";
import { csvRecordToParsedPatient } from "../validate-and-parse-import";

let mapCsvPatientToMetriportPatientMock: jest.SpyInstance;

beforeAll(() => {
  mapCsvPatientToMetriportPatientMock = jest
    .spyOn(convertPatient, "mapCsvPatientToMetriportPatient")
    .mockReturnValue(makePatientPayload());
});
afterAll(() => {
  jest.resetAllMocks();
});
beforeEach(() => {
  jest.clearAllMocks();
});

describe("validate-and-parse-import", () => {
  describe("csvRecordToParsedPatient", () => {
    it("returns raw data", () => {
      const data = {
        firstname: "John",
        lastname: "Doe",
        addressline1: "123 Main St",
      };
      const rowNumber = 1;
      const result = csvRecordToParsedPatient(data, rowNumber);
      expect(mapCsvPatientToMetriportPatientMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual(
        expect.objectContaining({
          rowNumber: 1,
          raw: "John,Doe,123 Main St",
        })
      );
    });

    it("wraps commas in quotes", () => {
      const data = {
        firstname: "John",
        lastname: "Doe",
        addressline1: "123 Main St, Anytown, USA",
      };
      const rowNumber = 1;
      const result = csvRecordToParsedPatient(data, rowNumber);
      expect(mapCsvPatientToMetriportPatientMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual(
        expect.objectContaining({
          rowNumber: 1,
          raw: 'John,Doe,"123 Main St, Anytown, USA"',
        })
      );
    });
  });
});
