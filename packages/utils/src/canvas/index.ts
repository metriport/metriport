import * as dotenv from "dotenv";
dotenv.config();

import CanvasSDK from "@metriport/core/external/canvas/index";
import { Condition, MedicationStatement, AllergyIntolerance } from "@medplum/fhirtypes";
import { faker } from "@faker-js/faker";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

const canvasClientSecret = getEnvVarOrFail(`CANVAS_CLIENT_SECRET`);
const canvasClientId = getEnvVarOrFail(`CANVAS_CLIENT_ID`);
const canvasPatientId = getEnvVarOrFail(`CANVAS_PATIENT_ID`);

function generateFakeConditionData(patientId: string, practitionerId: string): Condition {
  return {
    resourceType: "Condition",
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: "active",
          display: "active",
        },
      ],
      text: "active",
    },
    verificationStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          code: "confirmed",
          display: "Confirmed",
        },
      ],
      text: "Confirmed",
    },
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-category",
            code: "encounter-diagnosis",
            display: "Encounter Diagnosis",
          },
        ],
        text: "Encounter Diagnosis",
      },
    ],
    code: {
      coding: [
        {
          system: "http://hl7.org/fhir/sid/icd-10-cm",
          code: "K21.9",
          display: "Gastro-esophageal reflux disease without esophagitis",
        },
      ],
      text: "Gastro-esophageal reflux disease without esophagitis",
    },
    subject: { reference: `Patient/${patientId}` },
    onsetDateTime: "2024-01-01",
    recorder: { reference: `Practitioner/${practitionerId}` },
    note: [{ text: "" }],
  };
}

function generateFakeMedicationData(patientId: string, encounterId: string): MedicationStatement {
  return {
    resourceType: "MedicationStatement",
    status: "active",
    medicationReference: {
      reference: "Medication/fdb-259872",
      display: "Omeprazole 20 mg capsule,delayed release",
    },
    subject: { reference: `Patient/${patientId}` },
    context: { reference: `Encounter/${encounterId}` },
    effectivePeriod: { start: faker.date.past().toISOString() },
    dosage: [{ text: "Take 1 capsule daily" }],
  };
}

function generateFakeAllergyData(
  patientId: string,
  encounterId: string,
  practitionerId: string
): AllergyIntolerance {
  return {
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
    encounter: { reference: `Encounter/${encounterId}` },
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
  };
}

async function main() {
  try {
    const canvas = await CanvasSDK.create({
      environment: "metriport-sandbox",
      clientId: canvasClientId,
      clientSecret: canvasClientSecret,
    });

    const practitioner = await canvas.getPractitioner("Wilson");
    const practitionerId = practitioner.id;

    const location = await canvas.getLocation();
    const locationId = location.id;

    const encounter = await canvas.getFirstEncounter(patientId);
    const encounterId = encounter.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noteKey = (encounter.extension as any)[0].valueId;
    console.log(encounterId);

    if (!locationId || !practitionerId || !encounterId) {
      throw new Error("Location ID or Practitioner ID is undefined");
    }

    const conditionData = generateFakeConditionData(canvasPatientId, practitionerId);
    await canvas.createCondition({
      condition: conditionData,
      patientId: canvasPatientId,
      practitionerId,
      noteId: noteKey,
    });

    const allergyData = generateFakeAllergyData(canvasPatientId, noteKey, practitionerId);
    await canvas.createAllergy({
      allergy: allergyData,
      patientId: canvasPatientId,
      practitionerId,
      noteId: noteKey,
      encounterId,
    });

    const medicationData = generateFakeMedicationData(canvasPatientId, encounterId);
    await canvas.createMedication({
      medication: medicationData,
      patientId: canvasPatientId,
      encounterId,
      noteId: noteKey,
    });
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
