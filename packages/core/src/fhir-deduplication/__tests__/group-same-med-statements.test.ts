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
  it("correctly groups medStatements with no dates based on medRef", () => {
    const medStatementNoDate1 = makeMedicationStatement({ id: faker.string.uuid() });
    const medStatementNoDate2 = makeMedicationStatement({ id: faker.string.uuid() });

    delete medStatementNoDate1.effectiveDateTime;
    delete medStatementNoDate2.effectiveDateTime;

    const { medStatementsMap } = groupSameMedStatements([medStatementNoDate1, medStatementNoDate2]);
    expect(medStatementsMap.size).toBe(1);
  });
  it("keeps and groups medStatements with an inline medicationCodeableConcept", () => {
    const medicationCodeableConcept = {
      coding: [
        { system: "canvas_compound", code: "tirzepatide-2-5", display: "Tirzepatide 2.5 mg" },
      ],
      text: "Tirzepatide 2.5 mg/0.5 mL injection",
    };
    delete medStatement.medicationReference;
    delete medStatement2.medicationReference;
    medStatement.medicationCodeableConcept = medicationCodeableConcept;
    medStatement2.medicationCodeableConcept = medicationCodeableConcept;

    const { medStatementsMap, danglingReferences } = groupSameMedStatements([
      medStatement,
      medStatement2,
    ]);
    expect(medStatementsMap.size).toBe(1);
    expect(danglingReferences.size).toBe(0);
  });

  it("does not group medStatements with different inline medications", () => {
    delete medStatement.medicationReference;
    delete medStatement2.medicationReference;
    medStatement.medicationCodeableConcept = { text: "Tirzepatide 2.5 mg" };
    medStatement2.medicationCodeableConcept = { text: "Semaglutide 0.25 mg" };

    const { medStatementsMap } = groupSameMedStatements([medStatement, medStatement2]);
    expect(medStatementsMap.size).toBe(2);
  });

  it("does not group inline medications that share only an unknown coding", () => {
    const unknown = { system: "http://terminology.hl7.org/ValueSet/v3-Unknown", code: "UNK" };
    delete medStatement.medicationReference;
    delete medStatement2.medicationReference;
    medStatement.medicationCodeableConcept = { coding: [unknown], text: "Tirzepatide 2.5 mg" };
    medStatement2.medicationCodeableConcept = { coding: [unknown], text: "Semaglutide 0.25 mg" };

    const { medStatementsMap } = groupSameMedStatements([medStatement, medStatement2]);
    expect(medStatementsMap.size).toBe(2);
  });

  it("keeps an inline medication whose local code contains unk", () => {
    delete medStatement.medicationReference;
    medStatement.medicationCodeableConcept = {
      coding: [{ system: "https://ehr.example/medications", code: "chunk-001" }],
    };

    const { medStatementsMap, danglingReferences } = groupSameMedStatements([medStatement]);
    expect(medStatementsMap.size).toBe(1);
    expect(danglingReferences.size).toBe(0);
  });

  it("keeps an inline medication named only by its coding display", () => {
    delete medStatement.medicationReference;
    medStatement.medicationCodeableConcept = {
      coding: [{ code: "tirzepatide-2-5", display: "Tirzepatide 2.5 mg" }],
    };

    const { medStatementsMap, danglingReferences } = groupSameMedStatements([medStatement]);
    expect(medStatementsMap.size).toBe(1);
    expect(danglingReferences.size).toBe(0);
  });
});
