import { faker } from "@faker-js/faker";
import {
  Bundle,
  BundleEntry,
  DiagnosticReport,
  Medication,
  Resource,
  Encounter,
  Patient,
  Observation,
} from "@medplum/fhirtypes";
import { makeBundle } from "../../external/fhir/__tests__/bundle";
import {
  findCompositionResource,
  findDiagnosticReportResources,
  findMedicationAdministrationResources,
  findMedicationRequestResources,
  findMedicationResources,
  findMedicationStatementResources,
  findEncounterResources,
} from "../../external/fhir/shared";
import { makeComposition } from "../../fhir-to-cda/cda-templates/components/__tests__/make-composition";
import { makeDiagnosticReport } from "../../fhir-to-cda/cda-templates/components/__tests__/make-diagnostic-report";
import { makeMedication } from "../../fhir-to-cda/cda-templates/components/__tests__/make-medication";
import { makeObservation } from "../../fhir-to-cda/cda-templates/components/__tests__/make-observation";
import { makeCondition } from "../../fhir-to-cda/cda-templates/components/__tests__/make-condition";
import { makeEncounter } from "../../fhir-to-cda/cda-templates/components/__tests__/make-encounter";
import { makePatient } from "../../fhir-to-cda/cda-templates/components/__tests__/make-patient";
import {
  makePractitioner,
  practitionerNameZoidberg,
} from "../../fhir-to-cda/cda-templates/components/__tests__/make-encounter";

import { deduplicateFhir } from "../deduplicate-fhir";
import { createRef } from "../shared";
import { dateTime } from "./examples/condition-examples";
import { rxnormCodeAm } from "./examples/medication-examples";
import {
  makeMedicationAdministration,
  makeMedicationRequest,
  makeMedicationStatement,
} from "./examples/medication-related";
import { loincCodeTobacco, valueConceptTobacco } from "./examples/observation-examples";
import { snomedCodeMd } from "./examples/condition-examples";

let medicationId: string;
let medicationId2: string;
let medication: Medication;
let medication2: Medication;
let bundle: Bundle;
let patient: Patient;
let patientId: string;
let cxId: string;
beforeAll(() => {
  medicationId = faker.string.uuid();
  medicationId2 = faker.string.uuid();
  medication = makeMedication({ id: medicationId });
  medication2 = makeMedication({ id: medicationId2 });
  patient = makePatient({
    gender: "male",
    name: [
      {
        family: "Doe",
        given: ["John"],
      },
    ],
    address: [
      {
        line: ["123 Main St"],
        city: "Anytown",
        state: "CA",
        postalCode: "12345",
      },
    ],
  });
  patientId = faker.string.uuid();
  cxId = faker.string.uuid();
});

beforeEach(() => {
  bundle = makeBundle({ entries: [] });
  bundle.type = "searchset";
});

describe("deduplicateFhir", () => {
  it("correctly deduplicates medication-related resources following medication deduplication and ref replacement", () => {
    medication.code = { coding: [rxnormCodeAm] };
    medication2.code = { coding: [rxnormCodeAm] };
    const medAdmin = makeMedicationAdministration({
      medicationReference: { reference: `Medication/${medicationId}` },
    });
    const medAdmin2 = makeMedicationAdministration({
      medicationReference: { reference: `Medication/${medicationId2}` },
    });

    const medRequest = makeMedicationRequest({
      medicationReference: { reference: `Medication/${medicationId}` },
    });
    const medRequest2 = makeMedicationRequest({
      medicationReference: { reference: `Medication/${medicationId2}` },
    });

    const medStatement = makeMedicationStatement({
      medicationReference: { reference: `Medication/${medicationId}` },
    });
    const medStatement2 = makeMedicationStatement({
      medicationReference: { reference: `Medication/${medicationId2}` },
    });

    const entries = [
      { resource: medication },
      { resource: medication2 },
      { resource: medAdmin },
      { resource: medAdmin2 },
      { resource: medRequest },
      { resource: medRequest2 },
      { resource: medStatement },
      { resource: medStatement2 },
      { resource: patient },
    ] as BundleEntry<Resource>[];
    bundle.entry = entries;
    bundle.type = "searchset";

    deduplicateFhir(bundle, cxId, patientId);
    expect(bundle.entry?.length).toBe(5);
    const resMedications = findMedicationResources(bundle);
    const resMedAdmins = findMedicationAdministrationResources(bundle);
    const resMedRequests = findMedicationRequestResources(bundle);
    const resMedStatements = findMedicationStatementResources(bundle);

    expect(resMedications.length).toBe(1);
    expect(resMedAdmins.length).toBe(1);
    expect(resMedRequests.length).toBe(1);
    expect(resMedStatements.length).toBe(1);

    expect(resMedAdmins[0]?.id).toBe(medAdmin.id);
    expect(resMedRequests[0]?.id).toBe(medRequest.id);
    expect(resMedStatements[0]?.id).toBe(medStatement.id);

    expect(JSON.stringify(resMedAdmins[0]?.extension)).toContain(medAdmin2.id);
    expect(JSON.stringify(resMedRequests[0]?.extension)).toContain(medRequest2.id);
    expect(JSON.stringify(resMedStatements[0]?.extension)).toContain(medStatement2.id);
  });

  it("removes useless medication and other resources referencing it", () => {
    medication.code = { text: "No known medications" };

    const medAdmin = makeMedicationAdministration({
      medicationReference: { reference: `Medication/${medicationId}` },
    });

    const medRequest = makeMedicationRequest({
      medicationReference: { reference: `Medication/${medicationId}` },
    });

    const medStatement = makeMedicationStatement({
      medicationReference: { reference: `Medication/${medicationId}` },
    });

    const entries = [
      { resource: medication },
      { resource: medAdmin },
      { resource: medRequest },
      { resource: medStatement },
      { resource: patient },
    ] as BundleEntry<Resource>[];
    bundle.entry = entries;
    deduplicateFhir(bundle, cxId, patientId);
    expect(bundle.entry?.length).toBe(1);
  });

  it("removes useless medication and other resources referencing it, but keeps good medication resource and other resources referencing it", () => {
    medication.code = { text: "No known medications" };
    medication2.code = { coding: [rxnormCodeAm] };

    const medAdmin = makeMedicationAdministration({
      medicationReference: { reference: `Medication/${medicationId}` },
    });
    const medAdmin2 = makeMedicationAdministration({
      medicationReference: { reference: `Medication/${medicationId2}` },
    });

    const medRequest = makeMedicationRequest({
      medicationReference: { reference: `Medication/${medicationId}` },
    });
    const medRequest2 = makeMedicationRequest({
      medicationReference: { reference: `Medication/${medicationId2}` },
    });

    const medStatement = makeMedicationStatement({
      medicationReference: { reference: `Medication/${medicationId}` },
    });
    const medStatement2 = makeMedicationStatement({
      medicationReference: { reference: `Medication/${medicationId2}` },
    });

    const entries = [
      { resource: medication },
      { resource: medication2 },
      { resource: medAdmin },
      { resource: medAdmin2 },
      { resource: medRequest },
      { resource: medRequest2 },
      { resource: medStatement },
      { resource: medStatement2 },
      { resource: patient },
    ] as BundleEntry<Resource>[];
    bundle.entry = entries;
    deduplicateFhir(bundle, cxId, patientId);
    expect(bundle.entry?.length).toBe(5);
    expect(JSON.stringify(bundle)).not.toContain(medicationId);
    expect(JSON.stringify(bundle)).toContain(medicationId2);
  });

  it("removes useless observation and the reference to it from the report", () => {
    const observationId = faker.string.uuid();
    const diagnosticReport = makeDiagnosticReport({
      id: faker.string.uuid(),
      result: [{ reference: `Observation/${observationId}` }],
      effectivePeriod: dateTime,
    });

    // making a useless observation
    const observation = makeObservation({ id: observationId, code: {} });

    const entries = [
      { resource: observation },
      { resource: diagnosticReport },
      { resource: patient },
    ] as BundleEntry<Resource>[];

    bundle.entry = entries;
    deduplicateFhir(bundle, cxId, patientId);
    expect(bundle.entry?.length).toBe(2);

    const diagnosticReports = findDiagnosticReportResources(bundle);
    expect(diagnosticReports.length).toBe(1);
    const remainingRes = diagnosticReports[0];
    expect(remainingRes?.id).toBe(diagnosticReport.id);
    expect(remainingRes?.resourceType).toBe("DiagnosticReport");
    expect(remainingRes?.result).toBe(undefined);
  });

  it("removes dangling links from a Composition", () => {
    const observationId = faker.string.uuid();
    const diagnosticReport = makeDiagnosticReport({
      id: faker.string.uuid(),
      result: [{ reference: `Observation/${observationId}` }],
      effectivePeriod: dateTime,
    });

    // making a useless observation
    const observation = makeObservation({ id: observationId, code: {} });

    const composition = makeComposition();
    composition.section = [
      {
        ...composition.section?.[0],
        entry: [
          {
            reference: `${createRef(observation)}`,
            display: "Observation 1",
          },
          {
            reference: `${createRef(diagnosticReport)}`,
            display: "DiagnosticReport 1",
          },
        ],
      },
    ];
    const entries = [
      { resource: observation },
      { resource: diagnosticReport },
      { resource: composition },
      { resource: patient },
    ] as BundleEntry<Resource>[];

    bundle.entry = entries;
    deduplicateFhir(bundle, cxId, patientId);
    expect(bundle.entry?.length).toBe(3);

    const resComposition = findCompositionResource(bundle);
    expect(resComposition).not.toEqual(undefined);
    const firstCompEntry = resComposition?.section?.[0]?.entry;
    expect(firstCompEntry?.length).toBe(1);
    expect(firstCompEntry?.[0]?.reference).toBe(createRef(diagnosticReport));
  });

  it("properly handles everything in a relatively large bundle", () => {
    medication.code = { text: "No known medications" };

    const medAdmin = makeMedicationAdministration({
      medicationReference: { reference: `Medication/${medicationId}` },
    });

    const medRequest = makeMedicationRequest({
      medicationReference: { reference: `Medication/${medicationId}` },
    });

    const medStatement = makeMedicationStatement({
      medicationReference: { reference: `Medication/${medicationId}` },
    });

    const observationId = faker.string.uuid();
    const observationId2 = faker.string.uuid();

    const observation = makeObservation({ id: observationId, code: {} });
    const observation2 = makeObservation({
      id: observationId2,
      valueCodeableConcept: valueConceptTobacco,
      code: loincCodeTobacco,
      effectiveDateTime: dateTime.start,
    });

    const observationRef = createRef(observation);
    const observation2Ref = createRef(observation2);

    const diagnosticReport = makeDiagnosticReport({
      id: faker.string.uuid(),
      result: [{ reference: observationRef }, { reference: observation2Ref }],
      effectivePeriod: dateTime,
    });

    const medAdminRef = createRef(medAdmin);
    const medRequestRef = createRef(medRequest);
    const medStatementRef = createRef(medStatement);
    const diagReportRef = createRef(diagnosticReport);

    const composition = makeComposition();
    composition.section = [
      {
        ...composition.section?.[0],
        entry: [
          {
            reference: observationRef,
            display: "Observation 1",
          },
          {
            reference: observation2Ref,
            display: "Observation 2",
          },
          {
            reference: medAdminRef,
            display: "MedicationAdministration 1",
          },
          {
            reference: medRequestRef,
            display: "MedicationRequest 1",
          },
          {
            reference: medStatementRef,
            display: "MedicationStatement 1",
          },
          {
            reference: diagReportRef,
            display: "DiagnosticReport 1",
          },
        ],
      },
    ];

    const entries = [
      { resource: medication },
      { resource: medAdmin },
      { resource: medRequest },
      { resource: medStatement },
      { resource: observation },
      { resource: observation2 },
      { resource: diagnosticReport },
      { resource: composition },
      { resource: patient },
    ] as BundleEntry<Resource>[];

    bundle.entry = entries;
    deduplicateFhir(bundle, cxId, patientId);
    expect(bundle.entry?.length).toBe(4);
    const resComposition = findCompositionResource(bundle);
    expect(resComposition).not.toEqual(undefined);
    const firstCompEntry = resComposition?.section?.[0]?.entry;
    expect(firstCompEntry?.length).toBe(2);
    expect(firstCompEntry).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reference: observation2Ref }),
        expect.objectContaining({ reference: diagReportRef }),
      ])
    );

    const resDiagReport = findDiagnosticReportResources(bundle)[0];
    expect(resDiagReport?.id).toBe(diagnosticReport.id);
    expect(resDiagReport?.resourceType).toBe("DiagnosticReport");
    expect(resDiagReport?.result).toEqual([{ reference: observation2Ref }]);
  });

  it("removes duplicate diagnosis references from an Encounter", () => {
    const condition1 = makeCondition({
      id: faker.string.uuid(),
      code: { coding: [snomedCodeMd] },
      onsetPeriod: dateTime,
    });
    const condition2 = makeCondition({
      id: faker.string.uuid(),
      code: { coding: [snomedCodeMd] },
      onsetPeriod: dateTime,
    });

    const encounter: Encounter = makeEncounter({
      id: faker.string.uuid(),
      diagnosis: [
        { condition: { reference: `Condition/${condition1.id}` } },
        { condition: { reference: `Condition/${condition2.id}` } },
      ],
      period: {
        start: "2013-08-22T17:05:00.000Z",
        end: "2013-08-22T18:15:00.000Z",
      },
    });

    const entries = [
      { resource: encounter },
      { resource: condition1 },
      { resource: condition2 },
      { resource: patient },
    ] as BundleEntry<Resource>[];

    bundle.entry = entries;
    deduplicateFhir(bundle, cxId, patientId);
    const deduplicatedEncounters = findEncounterResources(bundle);
    const deduplicatedEncounter = deduplicatedEncounters[0];
    expect(deduplicatedEncounter?.diagnosis?.length).toBe(1);
  });
  it("removes duplicate observation references from a DiagnosticReport", () => {
    const observation1 = makeObservation({
      id: faker.string.uuid(),
      valueCodeableConcept: valueConceptTobacco,
      code: loincCodeTobacco,
      effectiveDateTime: dateTime.start,
    });
    const observation2 = makeObservation({
      id: faker.string.uuid(),
      valueCodeableConcept: valueConceptTobacco,
      code: loincCodeTobacco,
      effectiveDateTime: dateTime.start,
    });

    const diagnosticReport: DiagnosticReport = makeDiagnosticReport({
      id: faker.string.uuid(),
      result: [
        { reference: `Observation/${observation1.id}` },
        { reference: `Observation/${observation2.id}` },
      ],
      effectivePeriod: {
        start: "2013-08-22T17:05:00.000Z",
        end: "2013-08-22T18:15:00.000Z",
      },
    });

    const entries = [
      { resource: diagnosticReport },
      { resource: observation1 },
      { resource: observation2 },
      { resource: patient },
    ] as BundleEntry<Resource>[];

    bundle.entry = entries;
    deduplicateFhir(bundle, cxId, patientId);
    const deduplicatedDiagnosticReports = findDiagnosticReportResources(bundle);
    const deduplicatedDiagnosticReport = deduplicatedDiagnosticReports[0];
    expect(deduplicatedDiagnosticReport?.result?.length).toBe(1);
  });
});

it("removes duplicate practitioner references from an Observation", () => {
  const practitionerId = faker.string.uuid();
  const practitioner = makePractitioner({ id: practitionerId, name: [practitionerNameZoidberg] });

  const observation = makeObservation({
    id: faker.string.uuid(),
    performer: [
      { reference: `Practitioner/${practitionerId}` },
      { reference: `Practitioner/${practitionerId}` },
    ],
    code: loincCodeTobacco,
    valueCodeableConcept: valueConceptTobacco,
    effectiveDateTime: dateTime.start,
  });

  const entries = [
    { resource: observation },
    { resource: practitioner },
    { resource: patient },
  ] as BundleEntry<Resource>[];

  bundle.entry = entries;
  deduplicateFhir(bundle, cxId, patientId);
  const deduplicatedObservation = bundle.entry?.find(
    entry => entry.resource?.resourceType === "Observation"
  )?.resource as Observation;

  expect(deduplicatedObservation?.performer?.length).toBe(1);
  expect(deduplicatedObservation?.performer?.[0]?.reference).toBe(`Practitioner/${practitionerId}`);
});
