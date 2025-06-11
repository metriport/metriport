import { faker } from "@faker-js/faker";
import {
  BundleEntry,
  Medication,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
  Reference,
  Resource,
  Bundle,
  Patient,
} from "@medplum/fhirtypes";
import { makeMedication } from "../../fhir-to-cda/cda-templates/components/__tests__/make-medication";
import { makePatient } from "../../fhir-to-cda/cda-templates/components/__tests__/make-patient";
import { removeResourcesWithDanglingLinks } from "../deduplicate-fhir";
import {
  makeMedicationAdministration,
  makeMedicationRequest,
  makeMedicationStatement,
} from "./examples/medication-related";
import { extractFhirTypesFromBundle } from "../../external/fhir/bundle/bundle";

let medicationId: string;
let medicationId2: string;
let medication: Medication;
let medStatement: MedicationStatement;
let medRequest: MedicationRequest;
let medAdmin: MedicationAdministration;
let patient: Patient;
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
  entries = [
    { resource: medStatement },
    { resource: medRequest },
    { resource: medAdmin },
    { resource: patient },
  ];
});

describe("removeResourcesWithDanglingLinks", () => {
  it("correctly removes med-related resources if the medication reference is a dangling link", () => {
    expect(entries.length).toBe(4);
    if (medRef.reference) {
      const danglingLinks = new Set([medRef.reference]);

      const bundle: Bundle = {
        type: "searchset",
        resourceType: "Bundle",
        entry: entries,
      };
      const extractedFhirTypes = extractFhirTypesFromBundle(bundle);
      const cleanedUpBundle = removeResourcesWithDanglingLinks(extractedFhirTypes, danglingLinks);
      expect(cleanedUpBundle.updatedResourceArrays.medicationStatements.length).toBe(0);
      expect(cleanedUpBundle.updatedResourceArrays.medicationAdministrations.length).toBe(0);
      expect(cleanedUpBundle.updatedResourceArrays.medicationRequests.length).toBe(0);
    }
  });

  it("does not remove a med-related resource that references another medication", () => {
    const medStatementWithoutDeadLink = makeMedicationStatement({ medicationReference: medRef2 });
    entries.push(...[{ resource: medication }, { resource: medStatementWithoutDeadLink }]);
    expect(entries.length).toBe(6);

    const bundle: Bundle = {
      type: "searchset",
      resourceType: "Bundle",
      entry: entries,
    };
    const extractedFhirTypes = extractFhirTypesFromBundle(bundle);

    if (medRef.reference) {
      const danglingLinks = new Set([medRef.reference]);
      const { updatedResourceArrays } = removeResourcesWithDanglingLinks(
        extractedFhirTypes,
        danglingLinks
      );
      expect(updatedResourceArrays.medicationStatements.length).toBe(1);
      expect(updatedResourceArrays.medications.length).toBe(1);
      const medStatement = updatedResourceArrays.medicationStatements.find(
        r => r.id === medStatementWithoutDeadLink.id
      ) as MedicationStatement | undefined;
      expect(medStatement?.id).toBe(medStatementWithoutDeadLink.id);
      expect(medStatement?.medicationReference).toBe(medRef2);
    }
  });
});
