import { FhirBundleSdk } from "../index";
import {
  validCompleteBundle,
  invalidBundleWrongType,
  invalidBundleWrongBundleType,
} from "./fixtures/fhir-bundles";
import { Patient } from "@medplum/fhirtypes";

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

  describe("Not Implemented Methods - Red Phase", () => {
    let sdk: FhirBundleSdk;

    beforeEach(() => {
      sdk = new FhirBundleSdk(validCompleteBundle);
    });

    it("should throw 'Not implemented' for validateReferences", () => {
      expect(() => sdk.validateReferences()).toThrow("Not implemented");
    });

    it("should throw 'Not implemented' for getResourceById", () => {
      expect(() => sdk.getResourceById<Patient>("patient-123")).toThrow("Not implemented");
    });

    it("should throw 'Not implemented' for getPatients", () => {
      expect(() => sdk.getPatients()).toThrow("Not implemented");
    });

    it("should throw 'Not implemented' for getObservations", () => {
      expect(() => sdk.getObservations()).toThrow("Not implemented");
    });

    it("should throw 'Not implemented' for getEncounters", () => {
      expect(() => sdk.getEncounters()).toThrow("Not implemented");
    });

    it("should throw 'Not implemented' for getPractitioners", () => {
      expect(() => sdk.getPractitioners()).toThrow("Not implemented");
    });

    it("should throw 'Not implemented' for getDiagnosticReports", () => {
      expect(() => sdk.getDiagnosticReports()).toThrow("Not implemented");
    });

    it("should throw 'Not implemented' for exportSubset", () => {
      expect(() => sdk.exportSubset(["patient-123"])).toThrow("Not implemented");
    });

    it("should throw 'Not implemented' for exportByType", () => {
      expect(() => sdk.exportByType("Patient")).toThrow("Not implemented");
    });

    it("should throw 'Not implemented' for exportByTypes", () => {
      expect(() => sdk.exportByTypes(["Patient", "Observation"])).toThrow("Not implemented");
    });
  });
});
