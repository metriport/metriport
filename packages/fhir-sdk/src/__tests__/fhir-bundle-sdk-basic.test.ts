import { FhirBundleSdk } from "../index";
import { invalidBundleWrongType, validCompleteBundle } from "./fixtures/fhir-bundles";

describe("FhirBundleSdk - Basic TDD Tests", () => {
  describe("Bundle Loading and Initialization", () => {
    describe("FR-1.1: SDK constructor accepts a FHIR Bundle object", () => {
      it("should accept a valid FHIR bundle without throwing", async () => {
        await expect(FhirBundleSdk.create(validCompleteBundle)).resolves.not.toThrow();
      });
    });

    describe("FR-1.2: SDK constructor throws error if bundle.resourceType !== 'Bundle'", () => {
      it("should throw error for invalid resourceType", async () => {
        await expect(FhirBundleSdk.create(invalidBundleWrongType)).rejects.toThrow(
          "Invalid bundle: resourceType must be 'Bundle'"
        );
      });
    });
  });
});
