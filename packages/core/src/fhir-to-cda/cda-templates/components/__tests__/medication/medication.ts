import { Medication, MedicationStatement } from "@medplum/fhirtypes";
import { uuidv7 } from "../../../../../util/uuid-v7";

export function makeMedicationStatementPair(
  medStatementId: string,
  medId: string,
  dateFhir: string
): { medicationStatement: MedicationStatement; medication: Medication } {
  const medicationStatement: MedicationStatement = {
    resourceType: "MedicationStatement",
    id: medStatementId,
    status: "active",
    medicationReference: {
      reference: `Medication/${medId}`,
    },
    subject: {
      reference: `Patient/${uuidv7()}`,
    },
    effectivePeriod: {
      start: dateFhir,
    },
    reasonCode: [
      {
        text: "heart",
      },
      {
        text: "weakness",
      },
    ],
    dosage: [
      {
        doseAndRate: [
          {
            doseQuantity: {
              value: 6.25,
              unit: "mg (milligram)",
            },
            rateQuantity: {
              value: 1,
              unit: "pill/day",
            },
          },
        ],
      },
    ],
  };

  const medication: Medication = {
    resourceType: "Medication",
    id: medId,
    code: {
      text: "CARVEDILOL",
      coding: [
        {
          code: "315577",
          display: "carvedilol 6.25 MG",
          system: "2.16.840.1.113883.6.88",
        },
        {
          code: "51407-040",
          display: "Carvedilol",
          system: "2.16.840.1.113883.6.69",
        },
      ],
    },
  };
  return { medicationStatement, medication };
}

export function makeMedicationStatementPair2(
  medStatementId: string,
  medId: string,
  dateFhir: string,
  endDateFhir: string
): { medicationStatement2: MedicationStatement; medication2: Medication } {
  const medicationStatement2: MedicationStatement = {
    resourceType: "MedicationStatement",
    id: medStatementId,
    status: "completed",
    medicationReference: {
      reference: `Medication/${medId}`,
    },
    subject: {
      reference: `Patient/${uuidv7()}`,
    },
    effectivePeriod: {
      start: dateFhir,
      end: endDateFhir,
    },
    reasonCode: [
      {
        text: "GERD",
      },
      {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "37796009",
            display: "Migraine",
          },
        ],
      },
    ],
    dosage: [
      {
        doseAndRate: [
          {
            doseQuantity: {
              value: 20,
              unit: "mg (milligram)",
            },
            rateQuantity: {
              value: 2,
              unit: "capsule/day",
            },
          },
        ],
      },
    ],
  };

  const medication2: Medication = {
    resourceType: "Medication",
    id: medId,
    code: {
      text: "OMEPRAZOLE",
      coding: [
        {
          code: "646344",
          display: "omeprazole 20 MG / sodium bicarbonate 1100 MG Oral Capsule",
          system: "2.16.840.1.113883.6.88",
        },
      ],
    },
  };
  return { medicationStatement2, medication2 };
}
