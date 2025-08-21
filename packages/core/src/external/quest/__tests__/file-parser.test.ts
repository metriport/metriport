import { parseResponseFile } from "../file/file-parser";
import { getArtifact } from "./shared";

describe("File parser", () => {
  it("should parse a response file", () => {
    const file = getArtifact("response.txt");
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
    expect(firstRow.patientId).toBe("0A1B2C3D4E5F6G7");
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
});
