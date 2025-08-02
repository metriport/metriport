import fs from "fs";
import path from "path";
import { Command } from "commander";
import { QuestSftpClient } from "@metriport/core/external/quest/client";
import { QuestDataMapper } from "@metriport/core/external/quest/data-mapper";
import { QuestSendBatchRequestHandlerDirect } from "@metriport/core/external/quest/command/send-batch-request/send-batch-request-direct";
import { getPatientsFromCsv } from "./shared";
import { QuestJob } from "@metriport/core/external/quest/types";

const program = new Command();

program
  .name("batch-request")
  .option("--cx-id <cx>", "The CX ID of the requester")
  .option("--facility-id <facility>", "The facility ID of the requester")
  .option("--patient-ids <patientIds>", "Specific patient IDs (comma separated) for the request")
  .option("--limit <limit>", "Limit the number of patients to send")
  .option("--roster-id <rosterId>", "Set the general mnemonic used to identify the roster")
  .option("--dry-run", "Dry run the request")
  .option("--csv-data <csv>", "The CSV data file to use for patient load")
  .description("Generate a patient load file and place into the outgoing replica directory")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async () => {
    const { cxId, facilityId, csvData, patientIds, dryRun, limit } = program.opts();

    if (!cxId) throw new Error("CX ID is required");
    if (!facilityId) throw new Error("Facility ID is required");

    let job: QuestJob | null = null;

    if (patientIds) {
      const ids: string[] = patientIds.split(",");
      job = await sendPatientRequestFromIds(cxId, facilityId, ids);
    } else if (csvData) {
      job = await sendPatientRequestFromCsv(cxId, facilityId, csvData, dryRun);
    } else {
      job = await sendFacilityRequest(cxId, facilityId, {
        dryRun,
        limit: limit ? parseInt(limit) : undefined,
      });
    }

    if (job) {
      const questDir = path.join(process.cwd(), "runs", "quest");
      fs.mkdirSync(questDir, { recursive: true });
      fs.writeFileSync(
        path.join(questDir, "master_job.json"),
        JSON.stringify(job, null, 2),
        "utf8"
      );
    }
  });

async function sendPatientRequestFromIds(
  cxId: string,
  facilityId: string,
  patientIds: string[]
): Promise<QuestJob> {
  const handler = new QuestSendBatchRequestHandlerDirect(
    new QuestSftpClient({
      logLevel: "debug",
    })
  );
  const job = await handler.sendBatchRequest({ cxId, facilityId, patientIds });
  return job;
}

async function sendPatientRequestFromCsv(
  cxId: string,
  facilityId: string,
  csvData: string,
  dryRun: boolean
): Promise<QuestJob | null> {
  const dataMapper = new QuestDataMapper();
  const facility = await dataMapper.getFacilityData(cxId, facilityId);
  const patients = await getPatientsFromCsv(csvData);
  const client = new QuestSftpClient({
    logLevel: "debug",
  });
  if (dryRun) {
    console.log("Dry run");
    console.log(patients.length, "patients");
    return null;
  } else {
    const job = await client.sendBatchRequest({ cxId, facility, patients });
    return job;
  }
}

async function sendFacilityRequest(
  cxId: string,
  facilityId: string,
  { dryRun, limit }: { dryRun: boolean; limit?: number }
): Promise<QuestJob | null> {
  const dataMapper = new QuestDataMapper();
  const requestData = await dataMapper.getFacilityRequestData({ cxId, facilityId, limit });
  const client = new QuestSftpClient({
    logLevel: "debug",
  });
  if (dryRun) {
    console.log("Dry run");
    console.log(requestData.patients.length, "patients");
    return null;
  } else {
    const job = await client.sendBatchRequest(requestData);
    return job;
  }
}

export default program;
