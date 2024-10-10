import { Bundle, Resource, Patient, Composition } from "@medplum/fhirtypes";
import { removeContainedPatients } from "../get-snapshot-local";

describe("removeContainedPatients", () => {
  it("returns the same bundle when there are no entries", () => {
    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
    };

    const result = removeContainedPatients(bundle);
    expect(result).toEqual(bundle);
  });

  it("returns the same bundle when entries have no contained resources", () => {
    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            id: "obs1",
          },
        },
      ],
    };

    const result = removeContainedPatients(bundle);
    expect(result).toEqual(bundle);
  });

  it("removes contained Patient resources from entries", () => {
    const patientResource: Patient = {
      resourceType: "Patient",
      id: "patient1",
    };

    const observationResource: Resource = {
      resourceType: "Observation",
      id: "obs1",
    };

    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
      entry: [
        {
          resource: {
            resourceType: "Composition",
            contained: [patientResource, observationResource],
          },
        },
      ],
    };

    const expectedContained = [observationResource];
    const result = removeContainedPatients(bundle);

    expect(result.entry).toBeDefined();
    expect((result.entry?.[0]?.resource as Composition)?.contained).toEqual(expectedContained);
  });

  it("handles entries with undefined contained property", () => {
    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
      entry: [
        {
          resource: {
            resourceType: "Composition",
          },
        },
      ],
    };

    const result = removeContainedPatients(bundle);
    expect(result).toEqual(bundle);
  });

  it("handles entries with empty contained array", () => {
    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
      entry: [
        {
          resource: {
            resourceType: "Composition",
            contained: [],
          },
        },
      ],
    };

    const result = removeContainedPatients(bundle);
    expect(result).toEqual(bundle);
  });

  it("removes multiple contained Patient resources", () => {
    const patientResource1: Patient = {
      resourceType: "Patient",
      id: "patient1",
    };

    const patientResource2: Patient = {
      resourceType: "Patient",
      id: "patient2",
    };

    const observationResource: Resource = {
      resourceType: "Observation",
      id: "obs1",
    };

    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
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

    const result = removeContainedPatients(bundle);

    expect((result.entry?.[0]?.resource as Composition)?.contained).toEqual(expectedContained);
  });

  it("does not remove resources other than Patient from contained", () => {
    const observationResource: Resource = {
      resourceType: "Observation",
      id: "obs1",
    };

    const medicationResource: Resource = {
      resourceType: "Medication",
      id: "med1",
    };

    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
      entry: [
        {
          resource: {
            resourceType: "Composition",
            contained: [observationResource, medicationResource],
          },
        },
      ],
    };

    const result = removeContainedPatients(bundle);

    expect(result).toEqual(bundle);
  });
});
