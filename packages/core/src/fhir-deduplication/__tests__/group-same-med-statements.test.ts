import { faker } from "@faker-js/faker";
import { MedicationStatement } from "@medplum/fhirtypes";
import {
  MedicationStatementStatus,
  groupSameMedStatements,
  pickMostDescriptiveStatus,
} from "../resources/medication-statement";
import { makeMedicationStatement } from "./examples/medication-related";

let medStatementId: string;
let medStatementId2: string;
let medStatement: MedicationStatement;
let medStatement2: MedicationStatement;

beforeEach(() => {
  medStatementId = faker.string.uuid();
  medStatementId2 = faker.string.uuid();
  medStatement = makeMedicationStatement({ id: medStatementId });
  medStatement2 = makeMedicationStatement({ id: medStatementId2 });
});

describe("groupSameMedStatements", () => {
  it("correctly groups duplicate medStatements based on medRef and date", () => {
    const { medStatementsMap } = groupSameMedStatements([medStatement, medStatement2]);
    expect(medStatementsMap.size).toBe(1);
  });

  it("chooses the most descriptive status", () => {
    medStatement.status = "unknown";
    medStatement2.status = "intended";
    const result = groupSameMedStatements([medStatement, medStatement2]);
    expect(result.medStatementsMap.values().next().value.status).toBe("intended");
  });
});

describe("pickMostDescriptiveStatus", () => {
  it("correctly picks the more descriptive status", () => {
    let status1: MedicationStatementStatus = "unknown";
    let status2: MedicationStatementStatus = "stopped";
    expect(pickMostDescriptiveStatus(status1, status2)).toEqual("stopped");

    status1 = "stopped";
    status2 = "unknown";
    expect(pickMostDescriptiveStatus(status1, status2)).toEqual("stopped");

    status1 = "active";
    status2 = "stopped";
    expect(pickMostDescriptiveStatus(status1, status2)).toEqual("stopped");

    status1 = "active";
    status2 = "completed";
    expect(pickMostDescriptiveStatus(status1, status2)).toEqual("completed");

    status1 = "intended";
    status2 = "active";
    expect(pickMostDescriptiveStatus(status1, status2)).toEqual("active");
  });
});
