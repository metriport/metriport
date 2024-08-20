import { faker } from "@faker-js/faker";
import { Bundle, BundleEntry, Medication, Resource } from "@medplum/fhirtypes";
import { makeMedication } from "../../fhir-to-cda/cda-templates/components/__tests__/make-medication";

import { makeBundle } from "../../external/fhir/__tests__/bundle";
import {
  findMedicationAdministrationResources,
  findMedicationRequestResources,
  findMedicationResources,
  findMedicationStatementResources,
} from "../../external/fhir/shared";
import { deduplicateFhir } from "../deduplicate-fhir";
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
});
