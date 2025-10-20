import { faker } from "@faker-js/faker";
import {
  Encounter,
  Medication,
  Observation,
  Organization,
  Practitioner,
  Resource,
} from "@medplum/fhirtypes";
import { MarkRequired } from "ts-essentials";
import { makeMedicationDispense } from "../../../../../external/fhir/__tests__/medication-dispense";
import { makePatient } from "../../../../../external/fhir/__tests__/patient";
import { makeReference } from "../../../../../external/fhir/__tests__/reference";
import {
  makeMedicationAdministration,
  makeMedicationRequest,
} from "../../../../../fhir-deduplication/__tests__/examples/medication-related";
import { makeCondition } from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-condition";
import { makeDiagnosticReport } from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-diagnostic-report";
import {
  makeEncounter as makeEncounterImported,
  makePractitioner,
} from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-encounter";
import { makeMedication } from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-medication";
import { makeObservation } from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-observation";
import { makeOrganization } from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-organization";

export const cxId = faker.string.uuid();
export const patient = makePatient();
export const patientId = patient.id;

export type MakeResource<Input extends Resource, MisRef extends Resource> = (res: MisRef) => Input;
export type Entry<Input extends Resource, MisRef extends Resource> = {
  makeInputResource: MakeResource<Input, MisRef>;
  resourceType: string;
  missingResource: MisRef;
  missingResourceType: string;
};

export const genericHydration = {
  conditionAndPractitioner: {
    makeInputResource: (missingResource: Practitioner) =>
      makeCondition({ recorder: makeReference(missingResource) }, patientId),
    resourceType: "Condition",
    missingResource: makePractitioner(),
    missingResourceType: "Practitioner",
  },

  practitionerAndOrganization: {
    makeInputResource: (missingResource: Organization) => makePractitionerWithOrg(missingResource),
    resourceType: "Practitioner",
    missingResource: makeOrganization(),
    missingResourceType: "Organization",
  },

  medicationAdministrationAndPractitioner: {
    makeInputResource: (missingPractitioner: Practitioner) =>
      makeMedicationAdministration({ performer: [makeReference(missingPractitioner)] }),
    resourceType: "MedicationAdministration",
    missingResource: makePractitioner(),
    missingResourceType: "Practitioner",
  },
};

export const nonSpecializedHydration = {
  conditionAndEncounter: {
    makeInputResource: (missingResource: Encounter) =>
      makeCondition({ encounter: makeReference(missingResource) }, patientId),
    resourceType: "Condition",
    missingResource: makeEncounter(undefined, patientId),
    missingResourceType: "Encounter",
  },

  conditionAndObservation: {
    makeInputResource: (missingResource: Observation) =>
      makeCondition({ stage: [{ assessment: [makeReference(missingResource)] }] }, patientId),
    resourceType: "Condition",
    missingResource: makeObservation(undefined, patientId),
    missingResourceType: "Observation",
  },

  encounterAndObservation: {
    makeInputResource: (missingResource: Observation) =>
      makeEncounter({ reasonReference: [makeReference(missingResource)] }, patientId),
    resourceType: "Encounter",
    missingResource: makeObservation(undefined, patientId),
    missingResourceType: "Observation",
  },
};

export const specializedHydration = {
  diagnosticReportAndEncounter: {
    makeInputResource: (missingEncounter: Encounter) =>
      makeDiagnosticReport({ encounter: makeReference(missingEncounter) }),
    resourceType: "DiagnosticReport",
    missingResource: makeEncounter(undefined, patientId),
    missingResourceType: "Encounter",
  },

  diagnosticReportAndObservation: {
    makeInputResource: (missingObservation: Observation) =>
      makeDiagnosticReport({ result: [makeReference(missingObservation)] }),
    resourceType: "DiagnosticReport",
    missingResource: makeObservation(undefined, patientId),
    missingResourceType: "Observation",
  },

  diagnosticReportAndPractitioner: {
    makeInputResource: (missingPractitioner: Practitioner) =>
      makeDiagnosticReport({ performer: [makeReference(missingPractitioner)] }),
    resourceType: "DiagnosticReport",
    missingResource: makePractitioner(),
    missingResourceType: "Practitioner",
  },

  diagnosticReportAndOrganization: {
    makeInputResource: (missingOrganization: Organization) =>
      makeDiagnosticReport({ performer: [makeReference(missingOrganization)] }),
    resourceType: "DiagnosticReport",
    missingResource: makeOrganization(),
    missingResourceType: "Organization",
  },

  medicationAdministrationAndMedication: {
    makeInputResource: (missingMedication: Medication) =>
      makeMedicationAdministration({ medicationReference: makeReference(missingMedication) }),
    resourceType: "MedicationAdministration",
    missingResource: makeMedication(),
    missingResourceType: "Medication",
  },

  medicationRequestAndMedication: {
    makeInputResource: (missingMedication: Medication) =>
      makeMedicationRequest({ medicationReference: makeReference(missingMedication) }),
    resourceType: "MedicationRequest",
    missingResource: makeMedication(),
    missingResourceType: "Medication",
  },

  medicationDispenseAndMedication: {
    makeInputResource: (missingMedication: Medication) =>
      makeMedicationDispense({ medicationReference: makeReference(missingMedication) }),
    resourceType: "MedicationDispense",
    missingResource: makeMedication(),
    missingResourceType: "Medication",
  },
};

export function makeEncounter(
  params: Partial<Encounter> | undefined,
  patientId: string
): MarkRequired<Encounter, "id"> {
  const encounter = makeEncounterImported(params, { patient: patientId });
  if (!params?.participant) encounter.participant = [];
  if (!params?.location) encounter.location = [];
  if (!encounter.id) throw new Error("Encounter ID is required");
  return { ...encounter, id: encounter.id };
}

export function makePractitionerWithOrg(org: Organization): Practitioner {
  return makePractitioner({
    qualification: [
      {
        issuer: makeReference(org),
      },
    ],
  });
}
