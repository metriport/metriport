import { Command } from "commander";
import {
  SearchAutomaton,
  SearchMatch,
} from "@metriport/core/external/comprehend/search/search-automaton";
import { listLocalCustomerIds, listLocalPatientIds, loadExtractionSources } from "./shared";

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
command.name("search");
command.description("Search documents for a specific phrase");
command.option("--cx-id <cx-id>", "The CX ID");
command.argument("[phrases...]", "The phrases to search for");
command.action(searchDocumentsAction);

async function searchDocumentsAction(
  phrases: string[],
  { cxId }: { cxId?: string }
): Promise<void> {
  const automaton = new SearchAutomaton(phrases);
  console.log("Search terms:", automaton.getSearchTerms());

  const cxIds = cxId ? [cxId] : listLocalCustomerIds();
  let totalPatientsMatched = 0;
  for (const cxId of cxIds) {
    console.log(`Searching documents of customer ${cxId}`);
    const patientIds = listLocalPatientIds(cxId);
    for (const patientId of patientIds) {
      const totalMatches = searchDocuments(automaton, cxId, patientId);
      if (totalMatches.length > 0) {
        totalPatientsMatched++;
      }
    }
  }

  console.log(`Found ${totalPatientsMatched} patients with matches`);
}

function searchDocuments(
  automaton: SearchAutomaton,
  cxId: string,
  patientId: string
): SearchMatch[] {
  const sources = loadExtractionSources(cxId, patientId);
  const matches: SearchMatch[] = [];
  for (const source of sources) {
    const sourceMatches = automaton.findAll(source.textContent);
    matches.push(...sourceMatches);

    for (const match of sourceMatches) {
      const fragment = source.textContent.substring(
        Math.max(0, match.startIndex - 80),
        Math.min(source.textContent.length, match.endIndex + 80)
      );
      console.log(fragment);
    }
  }
  return matches;
}

export default command;
