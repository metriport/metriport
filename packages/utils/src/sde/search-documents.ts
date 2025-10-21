import { Command } from "commander";
import { SearchAutomaton } from "@metriport/core/external/comprehend/search/search-automaton";
// import { searchDocuments } from "@metriport/core/external/sde/command/document/search-documents";

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

async function searchDocumentsAction(phrases: string[], { cxId }: { cxId: string }): Promise<void> {
  console.log(`Searching for documents in customer ${cxId} with phrases: ${phrases.join(", ")}`);
  const automaton = new SearchAutomaton(phrases);
  console.log(automaton.getSearchTerms());
  // console.log(documents);
}

export default command;
