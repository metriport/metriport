import { Command } from "commander";
import { loadPatientIds, listLocalPatientIds, savePatientIds } from "./shared";
import { SurescriptsDataMapper as DataMapper } from "@metriport/core/external/surescripts/data-mapper";

/**
 * List patients by CX ID
 * Usage:
 *
 * npm run sde -- list-patients --cx-id <cx-id>
 */
const command = new Command("list-patients");
command.description("List patients by CX ID");
command.requiredOption("--cx-id <cx-id>", "The CX ID");
command.requiredOption("--facility-id <facility-id>", "The facility ID");
command.option("--use-cache", "Use the cached patient IDs");
command.action(listPatients);

export async function listPatients({
  cxId,
  facilityId,
  useCache,
}: {
  cxId: string;
  facilityId: string;
  useCache?: boolean;
}) {
  console.log(`Listing patients by CX ID: ${cxId}`);
  let patientIds: string[] = [];
  if (useCache) {
    patientIds = loadPatientIds(cxId);
  } else {
    // patientIds = await listPatientIdsWithDocuments({ cxId });
    const dataMapper = new DataMapper();
    patientIds = await dataMapper.getPatientIdsForFacility({ cxId, facilityId });
    savePatientIds(cxId, patientIds);
  }
  console.log(`Found ${patientIds.length} patients`);

  const localPatientIds = listLocalPatientIds(cxId);
  const patientIdSet = new Set(patientIds);

  const existingPatientIds = localPatientIds.filter(id => patientIdSet.has(id));
  console.log(
    `Found ${existingPatientIds.length} patients with source documents (${Math.round(
      (existingPatientIds.length / patientIds.length) * 100
    )}%)`
  );
}

export default command;
