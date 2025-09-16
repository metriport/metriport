import { Command } from "commander";
import {
  buildRxNormArtifact,
  buildConditionArtifact,
  buildSnomedCTArtifact,
  getArtifact,
  listArtifactIds,
} from "./shared";

/**
 * Rebuilds all tests in the `packages/core/src/external/comprehend/__tests__` directory.
 */
const command = new Command();
command.name("build-all-tests");
command.description("Rebuild all tests");
command.action(async () => {
  await rebuildAllRxNormTests();
  await rebuildAllConditionTests();
  await rebuildAllSnomedCTTests();
});

async function rebuildAllRxNormTests() {
  const artifactIds = listArtifactIds("rxnorm");
  for (const artifactId of artifactIds) {
    const artifact = getArtifact("rxnorm", artifactId);
    await buildRxNormArtifact({ name: artifactId, inputText: artifact.inputText });
  }
}

async function rebuildAllConditionTests() {
  const artifactIds = listArtifactIds("icd10cm");
  for (const artifactId of artifactIds) {
    const artifact = getArtifact("icd10cm", artifactId);
    await buildConditionArtifact({ name: artifactId, inputText: artifact.inputText });
  }
}

async function rebuildAllSnomedCTTests() {
  const artifactIds = listArtifactIds("snomedct");
  for (const artifactId of artifactIds) {
    const artifact = getArtifact("snomedct", artifactId);
    await buildSnomedCTArtifact({ name: artifactId, inputText: artifact.inputText });
  }
}

export default command;
