import { Command } from "commander";
import { getFhirResourcesFromRxNormEntities } from "@metriport/core/external/comprehend/rxnorm/fhir-converter";
import { getFhirResourcesFromSnomedEntities } from "@metriport/core/external/comprehend/snomed/fhir-converter";
import {
  TEST_PATIENT_ID,
  TEST_DATE_NOTE_WRITTEN,
  TEST_ENCOUNTER_ID,
  TEST_CONFIDENCE_THRESHOLD,
} from "@metriport/core/external/comprehend/__tests__/constants";
import { getArtifact, listArtifactIds, writeFhirArtifact } from "./shared";

/**
 * Rebuilds all tests in the `packages/core/src/external/comprehend/__tests__/artifacts` directory. After rebuilding,
 * there should be a manual spot check of the generated resources for each test case, to ensure that the output
 * is still a valid FHIR representation of the original input text.
 *
 * Usually, this command will need to be run when expanding on the supported feature set from Comprehend Medical,
 * such as supporting a new attribute/trait or FHIR parsing method.
 */
const command = new Command();
command.name("build-all-tests");
command.description("Build all tests");
command.action(async () => {
  await rebuildAllRxNormTests();
  await rebuildAllSnomedCTTests();
});

/**
 * Rebuilds all RxNorm tests in the `packages/core/src/external/comprehend/__tests__/artifacts/rxnorm` directory.
 */
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

/**
 * Rebuilds all SNOMED CT tests in the `packages/core/src/external/comprehend/__tests__/artifacts/snomedct` directory.
 */
async function rebuildAllSnomedCTTests() {
  const artifactIds = listArtifactIds("snomedct");
  for (const artifactId of artifactIds) {
    const artifact = getArtifact("snomedct", artifactId);
    const resources = getFhirResourcesFromSnomedEntities(artifact.response.Entities ?? [], {
      confidenceThreshold: TEST_CONFIDENCE_THRESHOLD,
      context: {
        patientId: TEST_PATIENT_ID,
        dateNoteWritten: TEST_DATE_NOTE_WRITTEN,
        originalText: artifact.inputText,
        encounterId: TEST_ENCOUNTER_ID,
      },
    });
    writeFhirArtifact("snomedct", artifactId, resources);
  }
}

export default command;
