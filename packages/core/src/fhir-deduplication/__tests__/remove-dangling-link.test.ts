import { faker } from "@faker-js/faker";
import {
  BundleEntry,
  Medication,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
  Reference,
  Resource,
} from "@medplum/fhirtypes";
import { makeMedication } from "../../fhir-to-cda/cda-templates/components/__tests__/make-medication";
import { removeResourcesWithDanglingLinks } from "../deduplicate-fhir";
import {
  makeMedicationAdministration,
  makeMedicationRequest,
  makeMedicationStatement,
} from "./examples/medication-related";

let medicationId: string;
let medicationId2: string;
let medication: Medication;
let medStatement: MedicationStatement;
let medRequest: MedicationRequest;
let medAdmin: MedicationAdministration;
let entries: BundleEntry<Resource>[];
let medRef: Reference<Medication>;
let medRef2: Reference<Medication>;

beforeEach(() => {
  medicationId = faker.string.uuid();
  medicationId2 = faker.string.uuid();
  medRef = { reference: `Medication/${medicationId}` };
  medRef2 = { reference: `Medication/${medicationId2}` };
  medication = makeMedication({ id: medicationId2 });
  medStatement = makeMedicationStatement({ medicationReference: medRef });
  medRequest = makeMedicationRequest({ medicationReference: medRef });
  medAdmin = makeMedicationAdministration({ medicationReference: medRef });
  entries = [medStatement, medRequest, medAdmin];
});

describe("removeResourcesWithDanglingLinks", () => {
  it("correctly picks the more descriptive status", () => {
    expect(entries.length).toBe(3);
    const cleanedUpBundle = removeResourcesWithDanglingLinks(entries, [JSON.stringify(medRef)]);
    expect(cleanedUpBundle.length).toBe(0);
  });

  it("does not remove a med-related resource that references another medication", () => {
    const medStatementWithoutDeadLink = makeMedicationStatement({ medicationReference: medRef2 });
    entries.push(...[medication, medStatementWithoutDeadLink]);
    expect(entries.length).toBe(5);

    const cleanedUpBundle = removeResourcesWithDanglingLinks(entries, [JSON.stringify(medRef)]);
    expect(cleanedUpBundle.length).toBe(2);
    const medStatement = cleanedUpBundle.find(r => r.id === medStatementWithoutDeadLink.id) as
      | MedicationStatement
      | undefined;
    expect(medStatement?.id).toBe(medStatementWithoutDeadLink.id);
    expect(medStatement?.medicationReference).toBe(medRef2);
  });
});
