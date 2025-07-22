import { makeRxNormEntity } from "./shared";
import { buildMedicationResources } from "../fhir/medication";
import { Medication, MedicationStatement } from "@medplum/fhirtypes";

describe("Medication FHIR mapping", () => {
  it("should map brand name medications", () => {
    const entity = makeRxNormEntity("avelox-brand");
    const resources = buildMedicationResources([entity], { confidenceThreshold: 0.5 });
    const medication = resources.find(
      resource => resource.resourceType === "Medication"
    ) as Medication;
    const medicationStatement = resources.find(
      resource => resource.resourceType === "MedicationStatement"
    ) as MedicationStatement;
    expect(medication).toBeDefined();
    expect(medicationStatement).toBeDefined();
  });

  it("should map medication with dosage and frequency", () => {
    const entity = makeRxNormEntity("azithromycin");
    const resources = buildMedicationResources([entity], { confidenceThreshold: 0.75 });

    const medication = resources.find(
      resource => resource.resourceType === "Medication"
    ) as Medication;
    const medicationStatement = resources.find(
      resource => resource.resourceType === "MedicationStatement"
    ) as MedicationStatement;
    expect(medication).toBeDefined();
    expect(medicationStatement).toBeDefined();

    expect(medication.code?.coding?.[0]?.code).toBe("248656");
  });

  // it("should map complex medication", () => {
  //   // const entity = makeRxNormEntity("azithromycin")

  // })
});
