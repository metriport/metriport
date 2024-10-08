/* eslint-disable @typescript-eslint/no-explicit-any */
import { makeCondition } from "../../../../fhir-to-cda/cda-templates/components/__tests__/make-condition";
import { makeDiagnosticReport } from "../../../../fhir-to-cda/cda-templates/components/__tests__/make-diagnostic-report";
import { makeObservation } from "../../../../fhir-to-cda/cda-templates/components/__tests__/make-observation";
import { uuidv7 } from "../../../../util/uuid-v7";
import { isPatient } from "../../shared";
import { makeAllergyIntollerance } from "../../__tests__/allergy-intolerance";
import { makeBundle } from "../../__tests__/bundle";
import { makePatient } from "../../__tests__/patient";
import {
  makeIdReference,
  makeReference,
  makeUrlReference,
  makeUrnUuidReference,
} from "../../__tests__/reference";
import { checkBundleForPatient, getPatientIdsFromPatient } from "../qa";

const invalidBundleMessage = "Bundle contains invalid data";

describe("Bundle QA", () => {
  describe("checkBundleForPatient", () => {
    it(`returns true when the bundle only contains the patient`, async () => {
      const cxId = uuidv7();
      const patient = makePatient();
      const bundle = makeBundle({ entries: [patient] });
      const res = checkBundleForPatient(bundle, cxId, patient.id);
      expect(res).toBeTruthy();
    });

    it(`returns true when only the expected patient is in the bundle`, async () => {
      const cxId = uuidv7();
      const patient = makePatient();
      const bundle = makeBundle({ entries: [patient] });
      const res = checkBundleForPatient(bundle, cxId, patient.id);
      expect(res).toBeTruthy();
    });

    it(`throws when there's more than one patient in the bundle`, async () => {
      const cxId = uuidv7();
      const patient1 = makePatient();
      const patient2 = makePatient();
      const bundle = makeBundle({ entries: [patient1, patient2] });
      expect(() => checkBundleForPatient(bundle, cxId, patient1.id)).toThrow(
        "Bundle contains more than one patient"
      );
    });

    it(`returns true when the bundle is empty`, async () => {
      const cxId = uuidv7();
      const patient = makePatient();
      const bundle = makeBundle({ entries: [] });
      const res = checkBundleForPatient(bundle, cxId, patient.id);
      expect(res).toBeTruthy();
    });

    it(`returns true when AllergyIntollerances point to the expected patient`, async () => {
      const cxId = uuidv7();
      const patient = makePatient();
      const bundle = makeBundle({
        entries: [
          patient,
          makeAllergyIntollerance({ patient }),
          makeAllergyIntollerance({ patient }),
        ],
      });
      const res = checkBundleForPatient(bundle, cxId, patient.id);
      expect(res).toBeTruthy();
    });

    it(`throw when the bundle has more than one patient`, async () => {
      const cxId = uuidv7();
      const patient1 = makePatient();
      const patient2 = makePatient();
      const bundle = makeBundle({
        entries: [
          patient1,
          patient2,
          makeAllergyIntollerance({ patient: patient1 }),
          makeAllergyIntollerance({ patient: patient1 }),
        ],
      });
      expect(() => checkBundleForPatient(bundle, cxId, patient1.id)).toThrow(
        "Bundle contains more than one patient"
      );
    });

    it(`throw when the bundle has the wrong patient`, async () => {
      const cxId = uuidv7();
      const patient1 = makePatient();
      const patient2 = makePatient();
      const bundle = makeBundle({
        entries: [
          patient2,
          makeAllergyIntollerance({ patient: patient1 }),
          makeAllergyIntollerance({ patient: patient1 }),
        ],
      });
      expect(() => checkBundleForPatient(bundle, cxId, patient1.id)).toThrow(
        "Patient in bundle is diff than expected"
      );
    });

    it(`throws when the bundle has an AllergyIntollerance with a diff patient`, async () => {
      const cxId = uuidv7();
      const patient1 = makePatient();
      const patient2 = makePatient();
      const bundle = makeBundle({
        entries: [
          patient1,
          makeAllergyIntollerance({ patient: patient1 }),
          makeAllergyIntollerance({ patient: patient2 }),
        ],
      });
      expect(() => checkBundleForPatient(bundle, cxId, patient1.id)).toThrow(invalidBundleMessage);
    });

    it(`throws when an Observation points to a diff patient`, async () => {
      const cxId = uuidv7();
      const patient1 = makePatient();
      const patient2 = makePatient();
      const observation = makeObservation({ subject: makeReference(patient2) });
      const bundle = makeBundle({ entries: [patient1, observation] });
      expect(() => checkBundleForPatient(bundle, cxId, patient1.id)).toThrow(invalidBundleMessage);
    });

    it(`throws when an Observation has a diff patient on contained`, async () => {
      const cxId = uuidv7();
      const patient1 = makePatient();
      const patient2 = makePatient();
      const observation = makeObservation({ subject: makeReference(patient1) });
      observation.contained = [patient2];
      const bundle = makeBundle({ entries: [observation] });
      expect(() => checkBundleForPatient(bundle, cxId, patient1.id)).toThrow(invalidBundleMessage);
    });

    it(`throws when the bundle has a Condition pointing to a diff patient`, async () => {
      const cxId = uuidv7();
      const patient1 = makePatient();
      const patient2 = makePatient();
      const bundle = makeBundle({
        entries: [
          makeCondition({ subject: makeReference(patient1) }),
          makeCondition({ subject: makeReference(patient2) }),
        ],
      });
      expect(() => checkBundleForPatient(bundle, cxId, patient1.id)).toThrow(invalidBundleMessage);
    });

    it(`does not throw when Condition references the same patient using urn:uuid`, async () => {
      const cxId = uuidv7();
      const patient1 = makePatient();
      const bundle = makeBundle({
        entries: [
          makeCondition({ subject: makeReference(patient1) }),
          makeCondition({ subject: makeUrnUuidReference(patient1) }),
        ],
      });
      const res = checkBundleForPatient(bundle, cxId, patient1.id);
      expect(res).toBeTruthy();
    });

    it(`throws when Condition references a diff patient using urn:uuid`, async () => {
      const cxId = uuidv7();
      const patient1 = makePatient();
      const patient2 = makePatient();
      const bundle = makeBundle({
        entries: [
          makeCondition({ subject: makeReference(patient1) }),
          makeCondition({ subject: makeUrnUuidReference(patient2) }),
        ],
      });
      expect(() => checkBundleForPatient(bundle, cxId, patient1.id)).toThrow(invalidBundleMessage);
    });

    it(`does not throw when Condition references the same patient using url`, async () => {
      const cxId = uuidv7();
      const patient1 = makePatient();
      const bundle = makeBundle({
        entries: [
          makeCondition({ subject: makeReference(patient1) }),
          makeCondition({ subject: makeUrlReference(patient1) }),
        ],
      });
      const res = checkBundleForPatient(bundle, cxId, patient1.id);
      expect(res).toBeTruthy();
    });

    it(`throws when Condition references a diff patient using url`, async () => {
      const cxId = uuidv7();
      const patient1 = makePatient();
      const patient2 = makePatient();
      const bundle = makeBundle({
        entries: [
          makeCondition({ subject: makeReference(patient1) }),
          makeCondition({ subject: makeUrlReference(patient2) }),
        ],
      });
      expect(() => checkBundleForPatient(bundle, cxId, patient1.id)).toThrow(invalidBundleMessage);
    });

    it(`throws when Condition references a diff patient using the reference's id with type`, async () => {
      const cxId = uuidv7();
      const patient1 = makePatient();
      const patient2 = makePatient();
      const bundle = makeBundle({
        entries: [
          makeCondition({ subject: makeReference(patient1) }),
          makeCondition({ subject: makeIdReference(patient2) }),
        ],
      });
      expect(() => checkBundleForPatient(bundle, cxId, patient1.id)).toThrow(invalidBundleMessage);
    });

    it(`does not throw when Condition references a diff patient using the reference's id without type`, async () => {
      const cxId = uuidv7();
      const patient1 = makePatient();
      const patient2 = makePatient();
      const idOnlyRef = makeIdReference(patient2);
      delete idOnlyRef.type;
      const bundle = makeBundle({
        entries: [
          makeCondition({ subject: makeReference(patient1) }),
          makeCondition({ subject: idOnlyRef }),
        ],
      });
      const res = checkBundleForPatient(bundle, cxId, patient1.id);
      expect(res).toBeTruthy();
    });

    it(`returns true when has a display to something that resembles a patient reference`, async () => {
      const cxId = uuidv7();
      const patient = makePatient();
      const diagReport = makeDiagnosticReport({ subject: makeReference(patient) });
      expect(diagReport.code).toBeTruthy();
      if (!diagReport.code) throw new Error("Expected diagReport.code to be defined");
      diagReport.code.coding = diagReport.code.coding ?? [];
      diagReport.code.coding.push({ display: "Patient/Family" });
      const bundle = makeBundle({ entries: [patient, diagReport] });

      const res = checkBundleForPatient(bundle, cxId, patient.id);
      expect(res).toBeTruthy();
    });
  });

  describe("getPatientIdsFromPatient", () => {
    it(`returns patient ID when it gets a single patient`, async () => {
      const patient = makePatient();
      const res = getPatientIdsFromPatient([patient]);
      expect(res).toBeTruthy();
      expect(res).toEqual(expect.arrayContaining([patient.id]));
    });

    it(`returns unique patient IDs`, async () => {
      const patient = makePatient();
      const res = getPatientIdsFromPatient([patient, patient]);
      expect(res).toBeTruthy();
      expect(res).toEqual(expect.arrayContaining([patient.id]));
    });

    it(`returns all patient IDs when it gets more than one patient`, async () => {
      const patients = [makePatient(), makePatient(), makePatient(), makePatient()];
      const res = getPatientIdsFromPatient(patients);
      expect(res).toBeTruthy();
      expect(res).toEqual(expect.arrayContaining(patients.map(p => p.id)));
    });

    it(`does not include IDs from resources that are not Patient`, async () => {
      const resources = [makePatient(), makeCondition(), makePatient()];
      const patients = resources.filter(isPatient);
      const res = getPatientIdsFromPatient(resources);
      expect(res).toBeTruthy();
      expect(res).toEqual(expect.arrayContaining(patients.map(p => p.id)));
    });
  });
});
