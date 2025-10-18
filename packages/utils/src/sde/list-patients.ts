import { Command } from "commander";
import { listPatientIdsWithDocuments } from "@metriport/core/external/sde/command/customer/list-patients";

/**
 * List patients by CX ID
 * Usage:
 *
 * npm run sde -- list-patients --cx-id <cx-id>
 */
const command = new Command("list-patients");
command.description("List patients by CX ID");
command.requiredOption("--cx-id <cx-id>", "The CX ID");
command.action(listPatients);

export async function listPatients({ cxId }: { cxId: string }) {
  console.log(`Listing patients by CX ID: ${cxId}`);
  const patients = await listPatientIdsWithDocuments({ cxId });
  console.log("Patients:", JSON.stringify(patients, null, 2));
}

export default command;
