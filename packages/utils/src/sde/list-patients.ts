import { Command } from "commander";
import { listPatientsByCxId } from "@metriport/core/external/sde/command/patients/list-by-cx-id";
// import { extractDocument } from "@metriport/core/external/sde/command/document/extract-document";

/**
 * List patients by CX ID
 * Usage:
 *
 * npm run sde -- list-patients --cx-id <cx-id>
 */
const command = new Command("list-patients");
command.description("List patients by CX ID");
command.requiredOption("--cx-id <cx-id>", "The CX ID");
command.requiredOption("--bucket-name <bucket-name>", "The bucket name");
command.action(listPatients);

export async function listPatients({ cxId, bucketName }: { cxId: string; bucketName?: string }) {
  console.log(`Listing patients by CX ID: ${cxId} and bucket name: ${bucketName}`);
  const patients = await listPatientsByCxId({ cxId, bucketName });
  console.log("Patients:", JSON.stringify(patients, null, 2));
}

export default command;
