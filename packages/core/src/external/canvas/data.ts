import {
  Bundle,
  BundleEntry,
  Condition,
  MedicationStatement,
  AllergyIntolerance,
} from "@medplum/fhirtypes";
import { faker } from "@faker-js/faker";

export function generateFakeBundleFemale(patientId: string, practitionerId: string): Bundle {
  const conditions = generateFakeConditionData1(patientId);
  const medications = generateFakeMedicationData1(patientId);
  const allergies = generateFakeAllergyData1(patientId, practitionerId);

  const entries: BundleEntry[] = [
    ...conditions.map(resource => ({ resource })),
    ...medications.map(resource => ({ resource })),
    ...allergies.map(resource => ({ resource })),
  ];

  return {
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries,
  };
}

export function generateFakeBundleMale(patientId: string, practitionerId: string): Bundle {
  const conditions = generateFakeConditionData2(patientId);
  const medications = generateFakeMedicationData2(patientId);
  const allergies = generateFakeAllergyData1(patientId, practitionerId);

  const entries: BundleEntry[] = [
    ...conditions.map(resource => ({ resource })),
    ...medications.map(resource => ({ resource })),
    ...allergies.map(resource => ({ resource })),
  ];

  return {
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries,
  };
}

export function generateFakeConditionData1(patientId: string): Condition[] {
  return [
    {
      resourceType: "Condition",
      id: "1b402f09-d141-4540-9d1a-569f272214d8",
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active",
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-category",
              code: "encounter-diagnosis",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "1149345007",
            display: "Maternal obesity syndrome in third trimester",
          },
        ],
        text: "Maternal obesity syndrome in third trimester",
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      onsetDateTime: "2021-04-20",
      recorder: {
        reference: "Practitioner/d8bfb775-97c3-4e69-bdc1-526fd7f0195f",
      },
    },
    {
      resourceType: "Condition",
      id: "1b402f09-d141-4540-9d1a-569f272214d8",
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active",
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-category",
              code: "encounter-diagnosis",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "134328007",
            display: "Lipoma (Benign)",
          },
        ],
        text: "Lipoma (Benign)",
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      onsetDateTime: "2023-04-20",
      recorder: {
        reference: "Practitioner/d8bfb775-97c3-4e69-bdc1-526fd7f0195f",
      },
    },
    {
      resourceType: "Condition",
      id: "1b402f09-d141-4540-9d1a-569f272214d8",
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active",
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-category",
              code: "encounter-diagnosis",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "722596001",
            display:
              "Class 1 obesity due to excess calories with serious comorbidity and body mass index (BMI) of 31.0 to 31.9 in adult",
          },
        ],
        text: "Lipoma (Benign)",
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      onsetDateTime: "2022-04-20",
      recorder: {
        reference: "Practitioner/d8bfb775-97c3-4e69-bdc1-526fd7f0195f",
      },
    },
  ];
}

export function generateFakeConditionData2(patientId: string): Condition[] {
  return [
    {
      resourceType: "Condition",
      id: "1b402f09-d141-4540-9d1a-569f272214d8",
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active",
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-category",
              code: "encounter-diagnosis",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "161833006",
            display: "Abnormal Weight Gain",
          },
        ],
        text: "Abnormal Weight Gain",
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      onsetDateTime: "2022-04-20",
      recorder: {
        reference: "Practitioner/d8bfb775-97c3-4e69-bdc1-526fd7f0195f",
      },
    },
    {
      resourceType: "Condition",
      id: "1b402f09-d141-4540-9d1a-569f272214d8",
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active",
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-category",
              code: "encounter-diagnosis",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "267434003",
            display: "Hyperlipidemia (Mixed)",
          },
        ],
        text: "Hyperlipidemia (Mixed)",
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      onsetDateTime: "2022-04-20",
      recorder: {
        reference: "Practitioner/d8bfb775-97c3-4e69-bdc1-526fd7f0195f",
      },
    },
    {
      resourceType: "Condition",
      id: "1b402f09-d141-4540-9d1a-569f272214d8",
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active",
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-category",
              code: "encounter-diagnosis",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "195967001",
            display: "Asthma (disorder)",
          },
        ],
        text: "Asthma (disorder)",
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      onsetDateTime: "2022-04-20",
      recorder: {
        reference: "Practitioner/d8bfb775-97c3-4e69-bdc1-526fd7f0195f",
      },
    },
    {
      resourceType: "Condition",
      id: "1b402f09-d141-4540-9d1a-569f272214d8",
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active",
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-category",
              code: "encounter-diagnosis",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "255032005",
            display: "Medullary Thyroid Cancer",
          },
        ],
        text: "Medullary Thyroid Cancer",
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      onsetDateTime: "2021-05-20",
      recorder: {
        reference: "Practitioner/d8bfb775-97c3-4e69-bdc1-526fd7f0195f",
      },
    },
  ];
}

export function generateFakeMedicationData1(patientId: string): MedicationStatement[] {
  return [
    {
      resourceType: "MedicationStatement",
      status: "active",
      medicationReference: {
        reference: "Medication/fdb-241223",
        display: "metFORMIN (GLUCOPHAGE) 1000 MG tablet",
      },
      subject: { reference: `Patient/${patientId}` },
      effectivePeriod: { start: faker.date.past().toISOString() },
      dosage: [{ text: "Take 1 capsule daily" }],
    },
  ];
}

export function generateFakeMedicationData2(patientId: string): MedicationStatement[] {
  return [
    {
      resourceType: "MedicationStatement",
      status: "active",
      medicationReference: {
        reference: "Medication/fdb-157536",
        display: "albuterol (90 mcg/dose) MDI",
      },
      subject: { reference: `Patient/${patientId}` },
      effectivePeriod: { start: faker.date.past().toISOString() },
      dosage: [{ text: "Take 1 capsule daily" }],
    },
  ];
}

export function generateFakeAllergyData1(
  patientId: string,
  practitionerId: string
): AllergyIntolerance[] {
  return [
    {
      resourceType: "AllergyIntolerance",
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
            code: "active",
            display: "Active",
          },
        ],
        text: "Active",
      },
      verificationStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
            code: "confirmed",
            display: "Confirmed",
          },
        ],
        text: "Confirmed",
      },
      type: "allergy",
      code: {
        coding: [{ system: "http://www.fdbhealth.com/", code: "6-7890", display: "bee pollen" }],
        text: "bee pollen",
      },
      patient: { reference: `Patient/${patientId}` },
      onsetDateTime: "2024-01-01",
      recorder: { reference: `Practitioner/${practitionerId}` },
      lastOccurrence: "2024-01-01",
      note: [{ text: "Rash" }],
      reaction: [
        {
          manifestation: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/data-absent-reason",
                  code: "unknown",
                  display: "Unknown",
                },
              ],
              text: "Unknown",
            },
          ],
          severity: "severe",
        },
      ],
    },
  ];
}
