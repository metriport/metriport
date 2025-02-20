import { Bundle, Resource, Patient, Composition } from "@medplum/fhirtypes";
import { faker } from "@faker-js/faker";
import { removeContainedPatients } from "../get-snapshot-local";

describe("removeContainedPatients", () => {
  const testPatientId = faker.string.uuid();

  it("returns the same bundle when there are no entries", () => {
    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
      total: 0,
    };

    const result = removeContainedPatients(bundle, testPatientId);
    expect(result).toEqual(bundle);
  });

  it("returns the same bundle when entries have no contained resources", () => {
    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
      total: 1,
      entry: [
        {
          resource: {
            resourceType: "Observation",
            id: faker.string.uuid(),
          },
        },
      ],
    };

    const result = removeContainedPatients(bundle, testPatientId);
    expect(result).toEqual(bundle);
  });

  it("removes contained Patient resources and leaves other resources with matching id from entries", () => {
    const patientResource: Patient = {
      resourceType: "Patient",
      id: faker.string.uuid(),
    };

    const observationResourceWithMatchingId: Resource = {
      resourceType: "Observation",
      id: testPatientId,
    };

    const observationResource: Resource = {
      resourceType: "Observation",
      id: faker.string.uuid(),
    };

    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
      total: 1,
      entry: [
        {
          resource: {
            resourceType: "Composition",
            contained: [patientResource, observationResourceWithMatchingId, observationResource],
          },
        },
      ],
    };

    const expectedContained = [observationResourceWithMatchingId, observationResource];
    const result = removeContainedPatients(bundle, testPatientId);

    expect(result.entry).toBeDefined();
    expect((result.entry?.[0]?.resource as Composition)?.contained).toEqual(expectedContained);
  });

  it("handles entries with undefined contained property", () => {
    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
      total: 1,
      entry: [
        {
          resource: {
            resourceType: "Composition",
          },
        },
      ],
    };

    const result = removeContainedPatients(bundle, testPatientId);
    expect(result).toEqual(bundle);
  });

  it("handles entries with empty contained array", () => {
    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
      total: 1,
      entry: [
        {
          resource: {
            resourceType: "Composition",
            contained: [],
          },
        },
      ],
    };

    const result = removeContainedPatients(bundle, testPatientId);
    expect(result).toEqual(bundle);
  });

  it("removes multiple contained Patient resources", () => {
    const patientResource1: Patient = {
      resourceType: "Patient",
      id: faker.string.uuid(),
    };

    const patientResource2: Patient = {
      resourceType: "Patient",
      id: faker.string.uuid(),
    };

    const observationResource: Resource = {
      resourceType: "Observation",
      id: faker.string.uuid(),
    };

    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
      total: 1,
      entry: [
        {
          resource: {
            resourceType: "Composition",
            contained: [patientResource1, patientResource2, observationResource],
          },
        },
      ],
    };

    const expectedContained = [observationResource];

    const result = removeContainedPatients(bundle, testPatientId);

    expect((result.entry?.[0]?.resource as Composition)?.contained).toEqual(expectedContained);
  });

  it("does not remove resources other than Patient and non-matching ids from contained", () => {
    const observationResource: Resource = {
      resourceType: "Observation",
      id: faker.string.uuid(),
    };

    const medicationResource: Resource = {
      resourceType: "Medication",
      id: faker.string.uuid(),
    };

    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
      total: 1,
      entry: [
        {
          resource: {
            resourceType: "Composition",
            contained: [observationResource, medicationResource],
          },
        },
      ],
    };

    const result = removeContainedPatients(bundle, testPatientId);

    expect(result).toEqual(bundle);
  });

  it("keeps one patient resource in contained with a matching id", () => {
    const patientResource1: Patient = {
      resourceType: "Patient",
      id: testPatientId,
    };

    const patientResource2: Patient = {
      resourceType: "Patient",
      id: faker.string.uuid(),
    };

    const observationResource: Resource = {
      resourceType: "Observation",
      id: faker.string.uuid(),
    };

    const medicationResource: Resource = {
      resourceType: "Medication",
      id: faker.string.uuid(),
    };

    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
      total: 1,
      entry: [
        {
          resource: {
            resourceType: "Composition",
            contained: [
              patientResource1,
              patientResource2,
              observationResource,
              medicationResource,
            ],
          },
        },
      ],
    };

    const expectedContained = [patientResource1, observationResource, medicationResource];

    const result = removeContainedPatients(bundle, testPatientId);

    expect((result.entry?.[0]?.resource as Composition)?.contained).toEqual(expectedContained);
  });
});
