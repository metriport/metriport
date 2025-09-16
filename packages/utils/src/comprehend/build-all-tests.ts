import { Command } from "commander";
import { getFhirResourcesFromRxNormEntities } from "@metriport/core/external/comprehend/rxnorm/fhir-converter";
import {
  TEST_PATIENT_ID,
  TEST_DATE_NOTE_WRITTEN,
  TEST_ENCOUNTER_ID,
  TEST_CONFIDENCE_THRESHOLD,
} from "@metriport/core/external/comprehend/__tests__/constants";
import { getArtifact, listArtifactIds, writeFhirArtifact } from "./shared";

/**
 * Rebuilds all tests in the `packages/core/src/external/comprehend/__tests__` directory.
 */
const command = new Command();
command.name("build-all-tests");
command.description("Build all tests");
command.action(async () => {
  await rebuildAllRxNormTests();
});

async function rebuildAllRxNormTests() {
  const artifactIds = listArtifactIds("rxnorm");
  for (const artifactId of artifactIds) {
    const artifact = getArtifact("rxnorm", artifactId);
    const resources = getFhirResourcesFromRxNormEntities(artifact.response.Entities ?? [], {
      confidenceThreshold: TEST_CONFIDENCE_THRESHOLD,
      context: {
        patientId: TEST_PATIENT_ID,
        dateNoteWritten: TEST_DATE_NOTE_WRITTEN,
        originalText: artifact.inputText,
        encounterId: TEST_ENCOUNTER_ID,
      },
    });
    writeFhirArtifact("rxnorm", artifactId, resources);
  }
}

export default command;
