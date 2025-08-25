import { Command } from "commander";
import { QuestReplica } from "@metriport/core/external/quest/replica";
import { parseSourceDocumentFileName } from "@metriport/core/external/quest/file/file-names";
import { QuestFhirConverterCommandDirect } from "@metriport/core/external/quest/command/fhir-converter/fhir-converter-direct";

/**
 * Reads all Quest source documents, and separately converts each source document into a FHIR bundle.
 */
const command = new Command();
command.name("fhir-convert-all");
command.description("Converts all source documents into FHIR bundles for each respective patient.");

command.action(async () => {
  const replica = new QuestReplica();
  const sourceDocumentKeys = await replica.listAllSourceDocumentKeys();

  const handler = new QuestFhirConverterCommandDirect();
  for (const sourceDocumentKey of sourceDocumentKeys) {
    const { externalId, dateId } = parseSourceDocumentFileName(sourceDocumentKey);
    await handler.convertSourceDocumentToFhirBundle({
      externalId,
      sourceDocumentKey,
    });
    console.log(`Created FHIR bundle for ${externalId} on ${dateId}`);
  }
});

export default command;
