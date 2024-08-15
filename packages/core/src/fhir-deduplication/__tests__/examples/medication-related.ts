import { faker } from "@faker-js/faker";
import {
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
} from "@medplum/fhirtypes";

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
    effectiveDateTime: "2017-11-14T11:15:00.000Z",
    medicationReference: { reference: "Medication/107fc532-e583-4aed-be84-333677a558b0" },
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

export function makeMedicationRequest(params: Partial<MedicationRequest>) {
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
    effectiveDateTime: "2017-11-14T11:15:00.000Z",
    medicationReference: { reference: "Medication/107fc532-e583-4aed-be84-333677a558b0" },
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

export function makeMedicationStatement(params: Partial<MedicationStatement>) {
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
    effectiveDateTime: "2017-11-14T11:15:00.000Z",
    medicationReference: { reference: "Medication/107fc532-e583-4aed-be84-333677a558b0" },
    dosage: [
      {
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
    ],
    ...params,
  };
}
