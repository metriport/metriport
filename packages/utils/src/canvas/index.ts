import * as dotenv from "dotenv";
dotenv.config();

import CanvasSDK from "@metriport/core/external/canvas/index";
import {
  Patient,
  Condition,
  MedicationStatement,
  AllergyIntolerance,
  Appointment,
} from "@medplum/fhirtypes";
import { faker } from "@faker-js/faker";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

const canvasToken = getEnvVarOrFail(`CANVAS_TOKEN`);

function generateFakePatientData(): Patient {
  const firstName = "Jonah" ?? faker.person.firstName();
  const lastName = "Kaye" ?? faker.person.lastName();
  const gender = faker.person.sex() as "male" | "female";
  const birthDate =
    faker.date.between({ from: "1940-01-01", to: "2005-12-31" }).toISOString().split("T")[0] ??
    "1940-01-01";

  return {
    resourceType: "Patient",
    extension: [
      {
        url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex",
        valueCode: gender === "male" ? "M" : "F",
      },
    ],
    identifier: [{ use: "usual", system: "INTERNAL", value: faker.string.uuid() }],
    active: true,
    name: [{ use: "official", family: lastName, given: [firstName] }],
    telecom: [
      { system: "phone", value: faker.phone.number("##########"), use: "mobile", rank: 1 },
      {
        system: "email",
        extension: [
          {
            url: "http://schemas.canvasmedical.com/fhir/extensions/has-consent",
            valueBoolean: true,
          },
        ],
        value: faker.internet.email({ firstName, lastName }),
        use: "work",
        rank: 1,
      },
    ],
    gender: gender,
    birthDate: birthDate,
    address: [
      {
        use: "home",
        type: "both",
        text: faker.location.streetAddress(true),
        line: [faker.location.streetAddress()],
        city: faker.location.city(),
        state: "CA",
        postalCode: faker.location.zipCode(),
        country: "US",
      },
    ],
  };
}

function generateFakeAppointmentData(patientId: string, practitionerId: string): Appointment {
  const startDate = faker.date.future();
  const endDate = new Date(startDate.getTime() + 30 * 60000); // 30 minutes later

  return {
    resourceType: "Appointment",
    status: "booked",
    supportingInformation: [{ reference: "Location/1" }],
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    participant: [
      { actor: { reference: `Patient/${patientId}` }, status: "accepted" },
      { actor: { reference: `Practitioner/${practitionerId}` }, status: "accepted" },
    ],
  };
}

function generateFakeConditionData(
  patientId: string,
  encounterId: string,
  practitionerId: string
): Condition {
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
    encounter: { reference: `Encounter/${encounterId}` },
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
    const canvas = new CanvasSDK({
      environment: "metriport-sandbox",
      token: canvasToken,
    });

    // Get a practitioner
    const practitioner = await canvas.getPractitioner("Wilson");
    const practionerId = canvas.setPractitionerId(practitioner.id);

    // Create a patient
    const patientData = generateFakePatientData();
    const patientId = await canvas.createPatient(patientData);
    canvas.setPatientId(patientId);

    // Create an appointment
    const appointmentData = generateFakeAppointmentData(patientId, practionerId);
    const appointmentId = await canvas.createAppointment(appointmentData);

    // // Get an encounter
    const encounter = await canvas.getEncounter();
    const encounterId = canvas.setEncounterId(encounter.id);

    // // Create a condition
    const conditionData = generateFakeConditionData(patientId, encounterId, practionerId);
    const conditionId = await canvas.createCondition(conditionData);

    // // Create a medication
    const medicationData = generateFakeMedicationData(patientId, encounterId);
    const medicationId = await canvas.createMedication(medicationData);

    // // Create an allergy
    const allergyData = generateFakeAllergyData(patientId, encounterId, practionerId);
    const allergyId = await canvas.createAllergy(allergyData);

    console.log("All operations completed successfully");
    console.log({
      patientId,
      appointmentId,
      encounterId: encounter.id,
      conditionId,
      medicationId,
      allergyId,
    });
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
