import { Command } from "commander";
import { listLocalDocumentIds, listLocalPatientIds } from "./shared";

/**
 * Calculate document statistics for a given CX ID
 */
const command = new Command();
command.name("statistics");
command.description("Generate statistics for the SDE");
command.requiredOption("--cx-id <cx-id>", "The CX ID");
command.action(sdeStatistics);

async function sdeStatistics({ cxId }: { cxId: string }) {
  let totalDocuments = 0;
  let totalPatients = 0;

  const patientIds = listLocalPatientIds(cxId);
  for (const patientId of patientIds) {
    const documentIds = listLocalDocumentIds(cxId, patientId);
    totalDocuments += documentIds.length;
    if (totalDocuments > 0) {
      totalPatients++;
    }
  }
  console.log(`Total documents: ${totalDocuments}`);
  console.log(`Total patients with documents: ${totalPatients}`);
  console.log(`Average documents per patient: ${totalDocuments / totalPatients}`);
}

export default command;
