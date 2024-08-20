import { faker } from "@faker-js/faker";
import {
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
} from "@medplum/fhirtypes";

const DEFAULT_MEDICATION_REF = `Medication/${faker.string.uuid()}`;

export function makeMedicationAdministration(params: Partial<MedicationAdministration>) {
  return {
    resourceType: "MedicationAdministration",
    ...(params.id ? { id: params.id } : { id: faker.string.uuid() }),
    extension: [
      {
        url: "https://public.metriport.com/fhir/StructureDefinition/doc-id-extension.json",
        valueString: `${faker.string.uuid()}.xml`,
      },
    ],
    status: "completed",
    effectiveDateTime: "2020-01-20T11:15:00.000Z",
    medicationReference: { reference: DEFAULT_MEDICATION_REF },
    dosage: {
      route: {
        coding: [
          {
            system: "http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl",
            code: "C38288",
            display: "Oral",
          },
        ],
        text: "Oral",
      },
      dose: { value: 0.4, unit: "mg", system: "http://unitsofmeasure.org" },
    },
    ...params,
  };
}

export function makeMedicationRequest(params: Partial<MedicationRequest>): MedicationRequest {
  return {
    resourceType: "MedicationRequest",
    ...(params.id ? { id: params.id } : { id: faker.string.uuid() }),
    extension: [
      {
        url: "https://public.metriport.com/fhir/StructureDefinition/doc-id-extension.json",
        valueString: `${faker.string.uuid()}.xml`,
      },
    ],
    status: "completed",
    authoredOn: "2020-01-20T11:15:00.000Z",
    medicationReference: { reference: DEFAULT_MEDICATION_REF },
    ...params,
  };
}

export function makeMedicationStatement(
  params: Partial<MedicationStatement> = {}
): MedicationStatement {
  return {
    resourceType: "MedicationStatement",
    ...(params.id ? { id: params.id } : { id: faker.string.uuid() }),
    extension: [
      {
        url: "https://public.metriport.com/fhir/StructureDefinition/doc-id-extension.json",
        valueString: `${faker.string.uuid()}.xml`,
      },
    ],
    status: "completed",
    effectiveDateTime: "2020-01-20T11:15:00.000Z",
    medicationReference: { reference: DEFAULT_MEDICATION_REF },
    dosage: [
      {
        text: "3 tablet, Oral, Once, On Sat 1/20/20 at 1600",
        route: {
          coding: [
            {
              system: "http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl",
              code: "C38288",
              display: "Oral",
            },
          ],
          text: "Oral",
        },
        doseAndRate: [
          {
            doseQuantity: {
              value: 3,
              unit: "{tbl}",
              system: "http://unitsofmeasure.org",
            },
          },
        ],
      },
    ],
    ...params,
  };
}
