import { MetriportError } from "@metriport/shared";
import {
  buildRosterFileName,
  parseResponseFileName,
  buildPatientLabConversionPrefix,
  buildLatestConversionFileName,
  buildLabConversionFileNameForDate,
} from "../file/file-names";

describe("parseResponseFileName", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("builds a roster file name", () => {
    expect(buildRosterFileName()).toBe("Metriport_roster_20250101.txt");
  });

  it("parses a correct date interval", () => {
    expect(parseResponseFileName("Metriport_202501010201.txt")).toEqual({
      dateId: "202501010201",
    });
  });

  it("throws on missing prefix", () => {
    expect(() => parseResponseFileName("Portal_202501010201.txt")).toThrow(MetriportError);
  });

  it("throws on wrong extension", () => {
    expect(() => parseResponseFileName("Metriport_202501010201.csv")).toThrow(MetriportError);
  });

  it("throws on non-numeric ID", () => {
    expect(() => parseResponseFileName("Metriport_20A501010201.txt")).toThrow(MetriportError);
  });

  it("throws on incorrect ID length", () => {
    expect(() => parseResponseFileName("Metriport_2025011.txt")).toThrow(MetriportError);
    expect(() => parseResponseFileName("Metriport_2025010123.txt")).toThrow(MetriportError);
  });

  it("throws on extra characters", () => {
    expect(() => parseResponseFileName("XMetriport_20250101.txtY")).toThrow(MetriportError);
  });

  it("builds a patient lab conversion prefix", () => {
    expect(
      buildPatientLabConversionPrefix({
        cxId: "eaa16107-a05e-4090-838e-a7f51d7921c1",
        patientId: "171a1b08-c27d-442a-9251-0905a29d0c49",
      })
    ).toBe(
      `quest/cxId=eaa16107-a05e-4090-838e-a7f51d7921c1/patientId=171a1b08-c27d-442a-9251-0905a29d0c49/dateId=`
    );
  });

  it("builds a latest conversion file name", () => {
    expect(
      buildLatestConversionFileName(
        "eaa16107-a05e-4090-838e-a7f51d7921c1",
        "171a1b08-c27d-442a-9251-0905a29d0c49"
      )
    ).toBe(
      "quest/cxId=eaa16107-a05e-4090-838e-a7f51d7921c1/patientId=171a1b08-c27d-442a-9251-0905a29d0c49/latest.json"
    );
  });

  it("builds a lab conversion file name for date", () => {
    expect(
      buildLabConversionFileNameForDate({
        cxId: "eaa16107-a05e-4090-838e-a7f51d7921c1",
        patientId: "171a1b08-c27d-442a-9251-0905a29d0c49",
        dateId: "202501010201",
      })
    ).toBe(
      "quest/cxId=eaa16107-a05e-4090-838e-a7f51d7921c1/patientId=171a1b08-c27d-442a-9251-0905a29d0c49/dateId=202501010201/conversion.json"
    );
  });
});
