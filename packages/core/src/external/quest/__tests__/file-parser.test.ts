import { parseResponseFile } from "../file/file-parser";
import { getArtifact } from "./shared";

describe("File parser", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-08-22T12:00:00-07:00"));
  });

  it("should parse a response file with a single row", () => {
    const file = getArtifact("response/single-patient.txt");
    const result = parseResponseFile(file);
    expect(result.length).toBe(1);

    const firstRow = result[0]?.data;
    expect(firstRow).toBeDefined();
    if (!firstRow) return;

    expect(firstRow.dateOfService).toEqual(new Date("2025-01-02T00:00:00.000Z"));
    expect(firstRow.dateCollected).toEqual(new Date("2025-01-01T00:00:00.000Z"));
    expect(firstRow.accessionNumber).toBe("AB123456Z");
    expect(firstRow.requisitionNumber).toBe("1234567");
    expect(firstRow.labCode).toBe("DLS");
    expect(firstRow.externalId).toBe("0A1B2C3D4E5F6G7");
    expect(firstRow.questPatientId).toBe("M1234567");
    expect(firstRow.patientFirstName).toBe("JANE");
    expect(firstRow.patientMiddleName).toBe("F");
    expect(firstRow.patientLastName).toBe("DOE");
    expect(firstRow.addressLine1).toBe("1234 TESTING DR");
    expect(firstRow.addressLine2).toBe(undefined);
    expect(firstRow.city).toBe("EXAMPLEVILLE");
    expect(firstRow.state).toBe("CA");
    expect(firstRow.zipCode).toBe("12345");
    expect(firstRow.phoneNumber).toBe("1234567890");
    expect(firstRow.dateOfBirth).toBe("19700515");
    expect(firstRow.patientAge).toEqual("55");
    expect(firstRow.gender).toBe("F");
    expect(firstRow.socialSecurityNumber).toBe(undefined);
    expect(firstRow.physicianName).toBe("SMITH,JOHN X");
    expect(firstRow.physicianNpi).toBe("1020304050");
    expect(firstRow.localProfileCode).toBe("5000000001");
    expect(firstRow.localOrderCode).toBe("5000000002");
    expect(firstRow.standardOrderCode).toBe("0000001");
    expect(firstRow.orderName).toBe("FOLATE, SERUM");
    expect(firstRow.loincCode).toBe("2284-8");
    expect(firstRow.localResultCode).toBe("55057100");
    expect(firstRow.resultName).toBe("FOLATE, SERUM");
    expect(firstRow.resultValue).toBe(">30.0");
    expect(firstRow.resultUnits).toBe("ng/mL");
    expect(firstRow.cptCode).toBe("82746");
    expect(firstRow.resultComments).toBe("Reference Range Not established");
  });

  it("should parse a response file with multiple patients", () => {
    const file = getArtifact("response/multiple-patients.txt");
    const result = parseResponseFile(file);
    expect(result.length).toBe(2);

    const secondRow = result[1]?.data;
    expect(secondRow).toBeDefined();
    if (!secondRow) return;

    expect(secondRow.dateOfService).toEqual(new Date("2025-01-02T00:00:00.000Z"));
    expect(secondRow.dateCollected).toEqual(new Date("2025-01-01T00:00:00.000Z"));
    expect(secondRow.accessionNumber).toBe("AB121212Z");
    expect(secondRow.requisitionNumber).toBe("9876543");
    expect(secondRow.labCode).toBe("DLS");
    expect(secondRow.externalId).toBe("9A8B7C6D5E4F3G2");
    expect(secondRow.questPatientId).toBe("M9876543");
    expect(secondRow.patientFirstName).toBe("BOB");
    expect(secondRow.patientMiddleName).toBe("K");
    expect(secondRow.patientLastName).toBe("DOLE");
    expect(secondRow.addressLine1).toBe("9898 FAKE BLVD");
    expect(secondRow.addressLine2).toBe(undefined);
    expect(secondRow.city).toBe("TESTTOWN");
    expect(secondRow.state).toBe("TX");
    expect(secondRow.zipCode).toBe("77777");
    expect(secondRow.phoneNumber).toBe("8171615141");
    expect(secondRow.dateOfBirth).toBe("20001218");
    expect(secondRow.patientAge).toBe("24");
    expect(secondRow.gender).toBe("M");
    expect(secondRow.socialSecurityNumber).toBe("424242424");
    expect(secondRow.orderingAccountNumber).toBe("12345");
    expect(secondRow.orderingAccountName).toBe("ANOTHER HOSPITAL");
    expect(secondRow.orderingAccountAddressLine1).toBe("9876 HIPPOCRATIC BLVD");
    expect(secondRow.orderingAccountAddressLine2).toBe(undefined);
    expect(secondRow.orderingAccountCity).toBe("TESTTOWN");
    expect(secondRow.orderingAccountState).toBe("TX");
    expect(secondRow.orderingAccountZipCode).toBe("776655443");
    expect(secondRow.orderingAccountPhoneNumber).toBe("1231231230");
    expect(secondRow.physicianName).toBe("WASHINGTON,GEORGE");
    expect(secondRow.physicianUpin).toBe(undefined);
    expect(secondRow.physicianNpi).toBe("9080706050");
    expect(secondRow.localProfileCode).toBe("2000000001");
    expect(secondRow.localOrderCode).toBe("2000000001");
    expect(secondRow.standardOrderCode).toBe("0000123");
    expect(secondRow.orderName).toBe("COMPREHENSIVE METABOLIC PANEL");
    expect(secondRow.loincCode).toBe("2160-0");
    expect(secondRow.localResultCode).toBe("25000200");
    expect(secondRow.resultName).toBe("CREATININE");
    expect(secondRow.resultValue).toBe("0.55");
    expect(secondRow.resultUnits).toBe("mg/dL");
    expect(secondRow.referenceRangeLow).toBe(".2");
    expect(secondRow.referenceRangeHigh).toBe(".73");
    expect(secondRow.referenceRangeAlpha).toBe("0.20-0.73");
    expect(secondRow.cptCode).toBe("80053");
    expect(secondRow.resultComments).toBe("Unable to calculate eGFR.");
  });
});
