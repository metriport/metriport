import { Bundle } from "@medplum/fhirtypes";
import NotFoundError from "../../util/error/not-found";
import { splitBundleByCompositions } from "../composition-splitter";

describe("splitBundleByCompositions", () => {
  it("returns an empty array for an empty input bundle", () => {
    const emptyBundle: Bundle = {
      resourceType: "Bundle",
      entry: [],
    };
    expect(splitBundleByCompositions(emptyBundle)).toEqual([]);
  });

  it("returns an empty array when no Composition resources are present", () => {
    const bundleWithNoCompositions: Bundle = {
      resourceType: "Bundle",
      entry: [{ resource: { resourceType: "Patient" } }],
    };
    expect(splitBundleByCompositions(bundleWithNoCompositions)).toEqual([]);
  });

  it("throws NotFoundError if the patient resource is missing", () => {
    const bundleWithMissingPatient: Bundle = {
      resourceType: "Bundle",
      entry: [{ resource: { resourceType: "Composition", subject: { reference: "Patient/123" } } }],
    };
    expect(() => splitBundleByCompositions(bundleWithMissingPatient)).toThrow(NotFoundError);
  });

  it("successfully splits bundle with valid Composition and all required references", () => {
    const validBundle: Bundle = {
      resourceType: "Bundle",
      entry: [
        {
          resource: {
            resourceType: "Composition",
            id: "comp1",
            subject: { reference: "Patient/123" },
            author: [{ reference: "Organization/456" }],
          },
        },
        { resource: { resourceType: "Patient", id: "123" } },
        { resource: { resourceType: "Organization", id: "456" } },
      ],
    };
    const result = splitBundleByCompositions(validBundle);
    expect(result.length).toBe(1);
    expect(result?.[0]?.entry?.length).toBe(3);
  });
});
