import { Command } from "commander";
import {
  SearchAutomaton,
  SearchMatch,
} from "@metriport/core/external/comprehend/search/search-automaton";
import { loadPatientIds, loadExtractionSources } from "./shared";
import { createMocaScoreObservation } from "@metriport/core/sde/resource/observation/moca-score";
import { getDiagnosticReportParams } from "@metriport/core/sde/resource/diagnostic-report";
import { createBundle } from "@metriport/core/sde/resource/bundle";
import { saveBundle } from "@metriport/core/sde/command/bundle/save-bundle";
import { SurescriptsDataMapper as DataMapper } from "@metriport/core/external/surescripts/data-mapper";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { Observation } from "@medplum/fhirtypes";

/**
 * Search all documents that have been retrieved locally for a particular phrase in the unstructured text.
 * Usage:
 * npm run sde -- search [phrases...]
 *
 * Search documents for a specific customer.
 * Usage:
 * npm run sde -- search --cx-id <cx-id> [phrases...]
 */
const command = new Command();
command.name("build-moca");
command.description("Build Moca Score Observations");
command.requiredOption("--cx-id <cx-id>", "The CX ID");
command.option("--dry-run", "Dry run the build process");
command.option("--recreate", "Recreate the consolidated bundle");
command.action(buildMocaScoreObservationsAction);

const CHARACTERS_AROUND_MATCH = 80;
const START_PHRASES = ["MOCA Score:", "MoCA Score:", "MOCA=", "MOCA ="];

async function buildMocaScoreObservationsAction({
  cxId,
  dryRun,
  recreate,
}: {
  cxId: string;
  dryRun?: boolean;
  recreate?: boolean;
}): Promise<void> {
  const automaton = new SearchAutomaton(START_PHRASES);

  console.log(`Building Moca Score Observations for customer ${cxId}`);
  const patientIds = loadPatientIds(cxId);
  let totalObservationsBuilt = 0;
  let totalPatientsExtracted = 0;

  await executeAsynchronously(
    patientIds,
    async patientId => {
      const observationsBuilt = await buildPatientMocaScoreObservations(
        automaton,
        cxId,
        patientId,
        { dryRun, recreate }
      );
      totalObservationsBuilt += observationsBuilt;
      if (observationsBuilt > 0) {
        totalPatientsExtracted++;
      }
    },
    {
      numberOfParallelExecutions: 10,
    }
  );

  console.log(`Built ${totalObservationsBuilt} Moca Score Observations`);
  console.log(`Extracted for ${totalPatientsExtracted} patients`);
}

async function buildPatientMocaScoreObservations(
  automaton: SearchAutomaton,
  cxId: string,
  patientId: string,
  { dryRun, recreate }: { dryRun?: boolean; recreate?: boolean } = {}
): Promise<number> {
  const sources = loadExtractionSources(cxId, patientId);
  const matches: SearchMatch[] = [];
  const observations: Record<string, Observation[]> = {};

  for (const source of sources) {
    const sourceMatches = automaton.findAll(source.textContent);
    matches.push(...sourceMatches);

    for (const match of sourceMatches) {
      const nextText = source.textContent.substring(
        match.endIndex,
        match.endIndex + CHARACTERS_AROUND_MATCH
      );
      const matches = nextText.match(/^\s*(\d+)\s*\/\s*(\d+)\s*/);
      if (matches) {
        const score = parseInt(matches[1]);
        const total = parseInt(matches[2]);
        const diagnosticReportParams = getDiagnosticReportParams(source.resource);
        if (score && total && diagnosticReportParams) {
          console.log(`Found Moca Score: ${score} / ${total} for patient ${patientId}`);
          const originalText = source.textContent
            .substring(match.startIndex - 1, match.endIndex + matches[0].length)
            .trim();
          console.log(`Original text: ${originalText}`);
          const observation = createMocaScoreObservation({
            diagnosticReport: source.resource,
            mocaScore: score,
            originalText,
          });
          if (!observations[source.documentId]) {
            observations[source.documentId] = [];
          }
          observations[source.documentId].push(observation);
        }
      }
    }
  }

  let totalCreated = 0;
  for (const documentId in observations) {
    const documentObservations = observations[documentId];
    console.log(`Saving ${documentObservations.length} observations for patient ${patientId}`);
    const bundle = createBundle(documentObservations);
    if (!dryRun) {
      await saveBundle({
        bundle,
        cxId,
        patientId,
        documentId,
      });
    }
    totalCreated += documentObservations.length;
  }

  if (recreate && totalCreated > 0) {
    try {
      const dataMapper = new DataMapper();
      await dataMapper.recreateConsolidatedBundle(cxId, patientId);
      console.log(`Recreated consolidated bundle for patient ${patientId}`);
      return totalCreated;
    } catch (error) {
      console.error(`Error recreating consolidated bundle for patient ${patientId}: ${error}`);
      return 0;
    }
  }
  return totalCreated;
}

export default command;
