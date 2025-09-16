import fs from "fs";
import path from "path";
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
  const rxNormDir = path.join(__dirname, "artifacts", "rxnorm");
  const rxNormArtifactIds = fs
    .readdirSync(rxNormDir)
    .filter(child => fs.statSync(path.join(rxNormDir, child)).isDirectory());
  const testContext = {
    patientId: TEST_PATIENT_ID,
    dateNoteWritten: TEST_DATE_NOTE_WRITTEN,
    encounterId: TEST_ENCOUNTER_ID,
    extensionUrl: DATA_EXTRACTION_URL,
  };

  it("should convert dosage frequency to FHIR", async () => {
    for (const artifactId of rxNormArtifactIds) {
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
        delete resource.id;
        if ("medicationReference" in resource) {
          delete resource.medicationReference;
        }
        if ("subject" in resource) {
          delete resource.subject;
        }
      }
      expect(resources).toEqual(expectedResources);
    }
  });
});
