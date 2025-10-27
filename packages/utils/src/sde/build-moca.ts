import { Command } from "commander";
import {
  SearchAutomaton,
  SearchMatch,
} from "@metriport/core/external/comprehend/search/search-automaton";
import { listLocalPatientIds, loadExtractionSources } from "./shared";
import { createMocaScoreObservation } from "@metriport/core/sde/resource/observation/moca-score";
import { getDiagnosticReportParams } from "@metriport/core/sde/resource/diagnostic-report";
import { createBundle } from "@metriport/core/sde/resource/bundle";
import { saveBundle } from "@metriport/core/sde/command/bundle/save-bundle";

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
command.action(buildMocaScoreObservationsAction);

const CHARACTERS_AROUND_MATCH = 80;
const START_PHRASES = ["MOCA Score:", "MoCA Score:", "MOCA=", "MOCA ="];

async function buildMocaScoreObservationsAction({ cxId }: { cxId: string }): Promise<void> {
  const automaton = new SearchAutomaton(START_PHRASES);

  console.log(`Building Moca Score Observations for customer ${cxId}`);
  const patientIds = listLocalPatientIds(cxId);
  let totalObservationsBuilt = 0;
  let totalPatientsExtracted = 0;
  for (const patientId of patientIds) {
    const observationsBuilt = await buildPatientMocaScoreObservations(automaton, cxId, patientId);
    totalObservationsBuilt += observationsBuilt;
    if (observationsBuilt > 0) {
      totalPatientsExtracted++;
    }
  }

  console.log(`Built ${totalObservationsBuilt} Moca Score Observations`);
  console.log(`Extracted for ${totalPatientsExtracted} patients`);
}

async function buildPatientMocaScoreObservations(
  automaton: SearchAutomaton,
  cxId: string,
  patientId: string
): Promise<number> {
  const sources = loadExtractionSources(cxId, patientId);
  const matches: SearchMatch[] = [];
  let totalMatches = 0;

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
            ...diagnosticReportParams,
            mocaScore: score,
            originalText,
          });

          console.log(`Saving observation for patient ${patientId}`);
          const bundle = createBundle([observation]);
          await saveBundle({
            bundle,
            cxId,
            patientId,
            documentId: source.documentId,
          });
          totalMatches++;
        }
      }
    }
  }
  return totalMatches;
}

export default command;
