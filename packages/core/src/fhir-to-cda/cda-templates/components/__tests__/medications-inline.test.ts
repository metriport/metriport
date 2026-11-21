import { Bundle, MedicationStatement } from "@medplum/fhirtypes";
import { removeEmptyFields } from "../../clinical-document/clinical-document";
import { xmlBuilder } from "../../clinical-document/shared";
import { buildMedications } from "../medications";
import { createEmptyBundle } from "./shared";

let bundle: Bundle;

beforeEach(() => {
  bundle = createEmptyBundle();
});

function makeInlineStatement(params: Partial<MedicationStatement> = {}): MedicationStatement {
  return {
    resourceType: "MedicationStatement",
    id: "med-statement-1",
    status: "active",
    subject: { reference: "Patient/patient-1" },
    effectivePeriod: { start: "2024-03-04" },
    medicationCodeableConcept: {
      coding: [{ system: "canvas_compound", code: "tirzepatide-2-5", display: "Tirzepatide" }],
      text: "Tirzepatide 2.5 mg/0.5 mL injection",
    },
    ...params,
  };
}

describe("buildMedications - inline medicationCodeableConcept", () => {
  it("renders a statement with no Medication reference instead of throwing", () => {
    bundle.entry?.push({ resource: makeInlineStatement() });

    const xml = xmlBuilder.build(removeEmptyFields(buildMedications(bundle)));
    expect(xml).toContain("<td>Tirzepatide 2.5 mg/0.5 mL injection</td>");
  });

  it("does not write a coding whose system is not a URI", () => {
    bundle.entry?.push({ resource: makeInlineStatement() });

    const xml = xmlBuilder.build(removeEmptyFields(buildMedications(bundle)));
    expect(xml).not.toContain("canvas_compound");
    expect(xml).not.toContain("tirzepatide-2-5");
  });

  it("keeps an RxNorm coding from the inline concept", () => {
    const statement = makeInlineStatement({
      medicationCodeableConcept: {
        coding: [
          {
            system: "http://www.nlm.nih.gov/research/umls/rxnorm",
            code: "123456",
            display: "Example medication",
          },
        ],
      },
    });
    bundle.entry?.push({ resource: statement });

    const xml = xmlBuilder.build(removeEmptyFields(buildMedications(bundle)));
    expect(xml).toContain(`code="123456"`);
    expect(xml).toContain(`codeSystem="2.16.840.1.113883.6.88"`);
  });

  it("still throws when there is neither a Medication nor an inline concept", () => {
    const statement = makeInlineStatement();
    delete statement.medicationCodeableConcept;
    bundle.entry?.push({ resource: statement });

    expect(() => buildMedications(bundle)).toThrow(
      "MedicationStatement must reference an existing Medication"
    );
  });
});
