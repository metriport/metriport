/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { faker } from "@faker-js/faker";
import {
  AllergyIntolerance,
  Binary,
  Bundle,
  BundleEntry,
  Condition,
  DocumentReference,
  Encounter,
  Location,
  Practitioner,
} from "@medplum/fhirtypes";
import { makeDocumentReference } from "@metriport/core/external/fhir/document/__tests__/document-reference";
import { buildBundleEntry } from "@metriport/core/external/fhir/bundle/bundle";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { makeBinary } from "@metriport/core/external/fhir/__tests__/binary";
import { PatientWithId } from "@metriport/core/external/fhir/__tests__/patient";
import { makeReference } from "@metriport/core/external/fhir/__tests__/reference";
import { snomedCodeMd } from "@metriport/core/fhir-deduplication/__tests__/examples/condition-examples";
import { makeAllergyMedication } from "@metriport/core/fhir-to-cda/cda-templates/components/__tests__/make-allergy";
import { makeCondition } from "@metriport/core/fhir-to-cda/cda-templates/components/__tests__/make-condition";
import {
  makeEncounter,
  makeLocation,
  makePractitioner,
} from "@metriport/core/fhir-to-cda/cda-templates/components/__tests__/make-encounter";
import { E2eContext, medicalApi } from "../shared";

export type ContributedPayloads = {
  entries: BundleEntry[];
  consolidated: Bundle;
  allergyIntolerance: AllergyIntolerance;
  condition: Condition;
  encounter: Encounter;
  location: Location;
  practitioner: Practitioner;
  documentReference: DocumentReference;
  binary: Binary;
};

export function runContributedTests(e2e: E2eContext) {
  it("prepares contributed", async () => {
    if (!e2e.patientFhir) throw new Error("Missing patientFhir");
    const payload = createContributedPayloads(e2e.patientFhir);
    e2e.contributed = {
      bundle: payload.consolidated,
      allergyIntolerance: payload.allergyIntolerance,
      condition: payload.condition,
      encounter: payload.encounter,
      location: payload.location,
      practitioner: payload.practitioner,
      documentReference: payload.documentReference,
      binary: payload.binary,
    };
  });

  it("contributes data", async () => {
    if (!e2e.patient) throw new Error("Missing patient");
    if (!e2e.contributed) throw new Error("Missing contributed");
    const contributed = e2e.contributed;
    const allergyId = contributed.allergyIntolerance.id;
    const conditionId = contributed.condition.id;
    const encounterId = contributed.encounter.id;
    const documentReferenceId = contributed.documentReference.id;
    try {
      const resultBundle = await medicalApi.createPatientConsolidated(
        e2e.patient.id,
        contributed.bundle
      );
      expect(resultBundle).toBeTruthy();
      expect(medicalApi.lastRequestId).toBeTruthy();
      e2e.putConsolidatedDataRequestId = medicalApi.lastRequestId;
      expect(resultBundle.type).toEqual("transaction-response");
      expect(resultBundle.entry).toBeTruthy();
      if (!resultBundle.entry) throw new Error("Missing entry");
      expect(resultBundle.entry.length).toEqual(contributed.bundle.entry?.length);
      expect(resultBundle.entry).toEqual(
        expect.arrayContaining([
          {
            response: expect.objectContaining({
              status: "201 Created",
              location: expect.stringContaining(`AllergyIntolerance/${allergyId}`),
              outcome: expect.objectContaining({
                resourceType: "OperationOutcome",
              }),
            }),
          },
          {
            response: expect.objectContaining({
              status: "201 Created",
              location: expect.stringContaining(`Condition/${conditionId}`),
              outcome: expect.objectContaining({
                resourceType: "OperationOutcome",
              }),
            }),
          },
          {
            response: expect.objectContaining({
              status: "201 Created",
              location: expect.stringContaining(`Encounter/${encounterId}`),
              outcome: expect.objectContaining({
                resourceType: "OperationOutcome",
              }),
            }),
          },
          {
            response: expect.objectContaining({
              status: "201 Created",
              location: expect.stringContaining(`DocumentReference/${documentReferenceId}`),
              outcome: expect.objectContaining({
                resourceType: "OperationOutcome",
              }),
            }),
          },
        ])
      );
    } catch (err) {
      console.log(`Error calling createPatientConsolidated(): `, err);
      throw err;
    }
  });
}

function createContributedPayloads(patient: PatientWithId): ContributedPayloads {
  const patientReference = makeReference(patient);
  const allergyIntolerance = makeAllergyMedication({ patient: patientReference });
  const dateTime = { start: "2012-01-01T10:00:00.000Z" };
  const condition = makeCondition(
    {
      id: faker.string.uuid(),
      code: { coding: [snomedCodeMd] },
      onsetPeriod: dateTime,
    },
    patient.id
  );
  const practitioner = makePractitioner();
  const location = makeLocation();
  const encounter: Encounter = makeEncounter(
    {
      id: faker.string.uuid(),
      diagnosis: [{ condition: { reference: `Condition/${condition.id}` } }],
      period: {
        start: "2013-08-22T17:05:00.000Z",
        end: "2013-08-22T18:15:00.000Z",
      },
    },
    { patient: patient.id, loc: location.id, pract: practitioner.id }
  );
  const binary = makeBinary();
  const documentReference = makeDocumentReference({
    patient,
    extension: [metriportDataSourceExtension],
    binary,
  });
  const entry: Bundle["entry"] = [condition, encounter, allergyIntolerance, documentReference].map(
    buildBundleEntry
  );
  return {
    entries: entry,
    consolidated: {
      resourceType: "Bundle",
      type: "collection",
      total: entry.length,
      entry,
    },
    allergyIntolerance,
    condition,
    encounter,
    location,
    practitioner,
    documentReference,
    binary,
  };
}
