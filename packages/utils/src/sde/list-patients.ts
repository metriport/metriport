import { Command } from "commander";
import { listPatientIdsWithDocuments } from "@metriport/core/external/sde/command/document/list-patients";
import { loadPatientIds, savePatientIds } from "./shared";

/**
 * List patients by CX ID
 * Usage:
 *
 * npm run sde -- list-patients --cx-id <cx-id>
 */
const command = new Command("list-patients");
command.description("List patients by CX ID");
command.requiredOption("--cx-id <cx-id>", "The CX ID");
command.option("--use-cache", "Use the cached patient IDs");
command.action(listPatients);

export async function listPatients({ cxId, useCache }: { cxId: string; useCache?: boolean }) {
  console.log(`Listing patients by CX ID: ${cxId}`);
  let patientIds: string[] = [];
  if (useCache) {
    patientIds = loadPatientIds(cxId);
  } else {
    patientIds = await listPatientIdsWithDocuments({ cxId });
    savePatientIds(cxId, patientIds);
  }
  console.log(`Found ${patientIds.length} patients`);
}

export default command;
