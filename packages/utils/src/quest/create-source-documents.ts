import { Command } from "commander";
import { QuestReplica } from "@metriport/core/external/quest/replica";
import { QuestCreateSourceDocumentsHandlerDirect } from "@metriport/core/external/quest/command/create-source-documents/create-source-documents-direct";

/**
 * Reads all Quest response files that have been retrieved from Quest at any point, and creates source
 * documents for each of them.
 */
const command = new Command();
command.name("create-source-documents");
command.description(
  "Reads all Quest response files that have been retrieved from Quest at any point, and creates source documents for each of them."
);

command.action(async () => {
  const replica = new QuestReplica();
  const responseFiles = await replica.listAllResponseFiles();

  const handler = new QuestCreateSourceDocumentsHandlerDirect();
  const sourceDocuments = await handler.createSourceDocuments(responseFiles);
  console.log(`Created ${sourceDocuments.length} source documents`);

  const externalIds = new Set(sourceDocuments.map(({ externalId }) => externalId));
  console.log(`Found ${externalIds.size} unique external IDs`);
});

export default command;
