import { Resource } from "@medplum/fhirtypes";
import { getFhirArtifact, getRxNormArtifact } from "./shared";
import { getFhirResourcesFromRxNormEntities } from "../rxnorm/fhir-converter";
import {
  TEST_PATIENT_ID,
  TEST_DATE_NOTE_WRITTEN,
  TEST_ENCOUNTER_ID,
  TEST_CONFIDENCE_THRESHOLD,
} from "./constants";
import { DATA_EXTRACTION_URL } from "../constants";

describe("FHIR converter", () => {
  const testContext = {
    patientId: TEST_PATIENT_ID,
    dateNoteWritten: TEST_DATE_NOTE_WRITTEN,
    encounterId: TEST_ENCOUNTER_ID,
    extensionUrl: DATA_EXTRACTION_URL,
  };

  function removeIdsAndReferences(resource: Resource): void {
    delete resource.id;
    if ("medicationReference" in resource) {
      delete resource.medicationReference;
    }
    if ("subject" in resource) {
      delete resource.subject;
    }
  }

  function testArtifact(artifactId: string): void {
    const { inputText, response } = getRxNormArtifact(artifactId);
    const resources = getFhirResourcesFromRxNormEntities(response.Entities ?? [], {
      confidenceThreshold: TEST_CONFIDENCE_THRESHOLD,
      context: {
        ...testContext,
        originalText: inputText,
      },
    });
    const expectedResources = getFhirArtifact("rxnorm", artifactId);
    // Remove ids and references
    for (const resource of resources) {
      removeIdsAndReferences(resource);
    }
    for (const resource of expectedResources) {
      removeIdsAndReferences(resource);
    }
    expect(resources).toEqual(expectedResources);
  }

  /**
   * A simple test case with a single medication with form and strength.
   * > Take Acetaminophen 500 mg tablet, 1-2 tablets orally every 6 hours as needed for pain, not to exceed 8 tablets per day.
   */
  it("should work for a simple test case with a single medication (acetaminophen)", async () => {
    testArtifact("acetaminophen");
  });

  /**
   * A test case with a single medication with multiple different attributes (frequency, dosage, form, strength, etc).
   * > Administer Amoxicillin 250 mg/5 mL suspension, 10 mL by mouth three times daily for 7 days.
   */
  it("should work for a complex test case with a single medication (amoxicillin)", async () => {
    testArtifact("amoxicillin");
  });
});
