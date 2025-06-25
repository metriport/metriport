import { FhirBundleSdk } from "../index";
import {
  invalidBundleWrongBundleType,
  invalidBundleWrongType,
  validCompleteBundle,
} from "./fixtures/fhir-bundles";

describe("FhirBundleSdk - Basic TDD Tests", () => {
  describe("Bundle Loading and Initialization", () => {
    describe("FR-1.1: SDK constructor accepts a FHIR Bundle object", () => {
      it("should accept a valid FHIR bundle without throwing", () => {
        expect(() => new FhirBundleSdk(validCompleteBundle)).not.toThrow();
      });
    });

    describe("FR-1.2: SDK constructor throws error if bundle.resourceType !== 'Bundle'", () => {
      it("should throw error for invalid resourceType", () => {
        expect(() => new FhirBundleSdk(invalidBundleWrongType)).toThrow(
          "Invalid bundle: resourceType must be 'Bundle'"
        );
      });
    });

    describe("FR-1.3: SDK constructor throws error if bundle.type !== 'collection'", () => {
      it("should throw error for invalid bundle type", () => {
        expect(() => new FhirBundleSdk(invalidBundleWrongBundleType)).toThrow(
          "Invalid bundle: type must be 'collection'"
        );
      });
    });
  });
});
