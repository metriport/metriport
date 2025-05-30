import { Medication, MedicationIngredient } from "@medplum/fhirtypes";
import { FlatFileDetail } from "../schema/response";

export async function parseMedication(detail: FlatFileDetail): Promise<Medication> {
  const [code, ingredient] = await Promise.all([
    parseMedicationCode(detail),
    parseMedicationIngredient(detail),
  ]);

  return {
    resourceType: "Medication",
    ...(code ? { code } : null),
    ...(ingredient && ingredient.length > 0 ? { ingredient } : null),
    extension: [
      {
        url: "http://hl7.org/fhir/StructureDefinition/medication-package-item",
        valueCodeableConcept: {
          coding: [
            {
              system: "http://www.nlm.nih.gov/research/umls/",
              code: detail.deaSchedule ?? "",
              display: detail.deaSchedule ?? "",
            },
          ],
        },
      },
    ],
  };
}

async function parseMedicationCode(detail: FlatFileDetail): Promise<Medication["code"]> {
  if (!detail.ndcNumber) return undefined;
  // TODO: do a terminology lookup

  // TODO: incorporate these
  detail.productCode;
  detail.productCodeQualifier;

  return {
    coding: [
      {
        system: "http://www.nlm.nih.gov/research/umls/",
        code: detail.ndcNumber,
        display: detail.drugDescription ?? "",
      },
    ],
  };
}

async function parseMedicationIngredient(
  detail: FlatFileDetail
): Promise<MedicationIngredient[] | null> {
  if (!detail.strengthValue || !detail.strengthFormCode || !detail.strengthUnitOfMeasure)
    return null;

  return [
    {
      strength: {
        numerator: {
          value: Number(detail.strengthValue),
          unit: detail.strengthUnitOfMeasure,
          system: "http://unitsofmeasure.org",
          code: detail.strengthFormCode,
        },
        denominator: {
          value: 1,
        },
      },
    },
  ];
}
