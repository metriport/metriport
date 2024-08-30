import { faker } from "@faker-js/faker";
import { Bundle, BundleEntry, DiagnosticReport, Medication, Resource } from "@medplum/fhirtypes";
import { makeBundle } from "../../external/fhir/__tests__/bundle";
import {
  findMedicationAdministrationResources,
  findMedicationRequestResources,
  findMedicationResources,
  findMedicationStatementResources,
} from "../../external/fhir/shared";
import { makeDiagnosticReport } from "../../fhir-to-cda/cda-templates/components/__tests__/make-diagnostic-report";
import { makeMedication } from "../../fhir-to-cda/cda-templates/components/__tests__/make-medication";
import { makeObservation } from "../../fhir-to-cda/cda-templates/components/__tests__/make-observation";
import { deduplicateFhir } from "../deduplicate-fhir";
import { dateTime } from "./examples/condition-examples";
import { rxnormCodeAm } from "./examples/medication-examples";
import {
  makeMedicationAdministration,
  makeMedicationRequest,
  makeMedicationStatement,
} from "./examples/medication-related";

let medicationId: string;
let medicationId2: string;
let medication: Medication;
let medication2: Medication;
let bundle: Bundle;

beforeAll(() => {
  medicationId = faker.string.uuid();
  medicationId2 = faker.string.uuid();
  medication = makeMedication({ id: medicationId });
  medication2 = makeMedication({ id: medicationId2 });
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
    ] as BundleEntry<Resource>[];
    bundle.entry = entries;
    bundle.type = "searchset";

    bundle = deduplicateFhir(bundle);
    expect(bundle.entry?.length).toBe(4);
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
    ] as BundleEntry<Resource>[];
    bundle.entry = entries;
    bundle = deduplicateFhir(bundle);
    expect(bundle.entry?.length).toBe(0);
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
    ] as BundleEntry<Resource>[];
    bundle.entry = entries;
    bundle = deduplicateFhir(bundle);
    expect(bundle.entry?.length).toBe(4);
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
    ] as BundleEntry<Resource>[];

    bundle.entry = entries;
    bundle = deduplicateFhir(bundle);
    expect(bundle.entry?.length).toBe(1);

    const remainingRes = bundle.entry?.[0]?.resource as DiagnosticReport;
    expect(remainingRes.id).toBe(diagnosticReport.id);
    expect(remainingRes.resourceType).toBe("DiagnosticReport");
    expect(remainingRes.result).toBe(undefined);
  });
});
