import { faker } from "@faker-js/faker";
import { MedicationStatement } from "@medplum/fhirtypes";
import { groupSameMedStatements } from "../resources/medication-statement";
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
