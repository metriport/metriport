import fs from "fs";
import path from "path";
import { Command } from "commander";
import { SurescriptsDataMapper } from "@metriport/core/external/surescripts/data-mapper";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";
import { SurescriptsFileIdentifier } from "@metriport/core/external/surescripts/types";
import { writeSurescriptsRunsFile } from "./shared";
import { executeAsynchronously } from "@metriport/core/util/concurrency";

/**
 * Runs the FHIR conversion process locally, for all patients of the given CX IDs
 * that are found in the Surescripts replica output.
 */
const program = new Command();
const replica = new SurescriptsReplica();
const dataMapper = new SurescriptsDataMapper();

program
  .name("reconversion")
  .description("Generate a roster of patients that need to be reconverted")
  .requiredOption("--cx-name <cx-name>", "The customer name used in file naming")
  .requiredOption("--cx-id <cx-id>", "The CX ID to perform reconversion")
  .requiredOption("--facility-id <facility-id>", "The facility ID to perform reconversion")
  .action(main);

async function main({
  cxId,
  facilityId,
  cxName,
}: {
  cxId: string;
  facilityId: string;
  cxName: string;
}) {
  const [patientIds, responses] = await Promise.all([
    dataMapper.getPatientIdsForFacility({ cxId, facilityId }),
    getResponseFiles(),
  ]);
  const patientIdSet = new Set(patientIds);
  console.log("found " + patientIds.length + " patient IDs");
  console.log("found " + responses.length + " response files");

  const identifiers: SurescriptsFileIdentifier[] = [];

  await executeAsynchronously(
    responses,
    async response => {
      if (patientIdSet.has(response.patientId)) {
        console.log("processing " + response.patientId);
        const fileContent = await replica.getRawResponseFileByKey(response.key);
        if (!fileContent) {
          console.log("file not found for " + response.patientId);
          return;
        }
        if (fileContent?.toString().startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
          throw new Error("XML file found for " + response.patientId);
        } else {
          console.log("found JSON for " + response.patientId);
          identifiers.push({
            transmissionId: response.transmissionId,
            populationId: response.patientId,
          });
        }
      }
    },
    {
      numberOfParallelExecutions: 10,
    }
  );

  console.log("found " + identifiers.length + " identifiers");

  writeSurescriptsRunsFile(
    cxName + "-roster.csv",
    `"patient_id","transmission_id"\n` +
      identifiers
        .map(identifier => `"${identifier.populationId}","${identifier.transmissionId}"`)
        .join("\n")
  );
}

async function getResponseFiles(): Promise<
  { key: string; transmissionId: string; patientId: string }[]
> {
  const responseFileCachePath = path.join(
    process.cwd(),
    "runs/surescripts/all-response-files.json"
  );
  if (fs.existsSync(responseFileCachePath)) {
    return JSON.parse(fs.readFileSync(responseFileCachePath, "utf8"));
  }
  const responses = await replica.listResponseFiles();
  fs.writeFileSync(responseFileCachePath, JSON.stringify(responses), "utf8");
  return responses;
}

export default program;
