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

const CHARACTERS_AROUND_MATCH = 80;

async function searchDocumentsAction(
  phrases: string[],
  { cxId }: { cxId?: string }
): Promise<void> {
  if (phrases.length === 0) {
    console.error("No search phrases provided");
    return;
  }
  const automaton = new SearchAutomaton(phrases);
  console.log("Search terms:", automaton.getSearchTerms());

  const customerIds = cxId ? [cxId] : listLocalCustomerIds();
  let totalPatientsMatched = 0;
  for (const customerId of customerIds) {
    console.log(`Searching documents of customer ${customerId}`);
    const patientIds = listLocalPatientIds(customerId);
    for (const patientId of patientIds) {
      const totalMatches = searchDocuments(automaton, customerId, patientId);
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
      const before = source.textContent.substring(
        Math.max(0, match.startIndex - CHARACTERS_AROUND_MATCH),
        match.startIndex
      );
      const after = source.textContent.substring(
        match.endIndex,
        Math.min(source.textContent.length, match.endIndex + CHARACTERS_AROUND_MATCH)
      );
      const text = source.textContent.substring(match.startIndex, match.endIndex);
      console.log(`${before}\x1b[1;32m${text}\x1b[0m${after}`);
    }
  }
  return matches;
}

export default command;
