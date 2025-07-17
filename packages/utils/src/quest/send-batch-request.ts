import { Command } from "commander";
import { QuestSftpClient } from "@metriport/core/external/quest/client";
import { QuestDataMapper } from "@metriport/core/external/quest/data-mapper";
import { QuestSendBatchRequestHandlerDirect } from "@metriport/core/external/quest/command/send-batch-request/send-batch-request-direct";
import { getPatientsFromCsv } from "./shared";

const program = new Command();

program
  .name("batch-request")
  .option("--cx-id <cx>", "The CX ID of the requester")
  .option("--facility-id <facility>", "The facility ID of the requester")
  .option("--patient-ids <patientIds>", "Specific patient IDs (comma separated) for the request")
  .option("--dry-run", "Dry run the request")
  .option("--csv-data <csv>", "The CSV data file to use for patient load")
  .description("Generate a patient load file and place into the outgoing replica directory")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async () => {
    const { cxId, facilityId, csvData, patientIds, dryRun } = program.opts();

    if (!cxId) throw new Error("CX ID is required");
    if (!facilityId) throw new Error("Facility ID is required");

    if (patientIds) {
      const ids: string[] = patientIds.split(",");
      await sendPatientRequestFromIds(cxId, facilityId, ids);
    } else if (csvData) {
      await sendPatientRequestFromCsv(cxId, facilityId, csvData, dryRun);
    } else {
      await sendFacilityRequest(cxId, facilityId, dryRun);
    }
  });

async function sendPatientRequestFromIds(cxId: string, facilityId: string, patientIds: string[]) {
  const handler = new QuestSendBatchRequestHandlerDirect(
    new QuestSftpClient({
      logLevel: "debug",
    })
  );
  const job = await handler.sendBatchRequest({ cxId, facilityId, patientIds });
  console.log("Job sent", job);
}

async function sendPatientRequestFromCsv(
  cxId: string,
  facilityId: string,
  csvData: string,
  dryRun: boolean
) {
  const dataMapper = new QuestDataMapper();
  const facility = await dataMapper.getFacilityData(cxId, facilityId);
  const patients = await getPatientsFromCsv(csvData);
  const client = new QuestSftpClient({
    logLevel: "debug",
  });
  if (dryRun) {
    console.log("Dry run");
    console.log(patients.length, "patients");
  } else {
    const job = await client.sendBatchRequest({ cxId, facility, patients });
    console.log("Sent job", job);
  }
}

async function sendFacilityRequest(cxId: string, facilityId: string, dryRun: boolean) {
  const dataMapper = new QuestDataMapper();
  const requestData = await dataMapper.getFacilityRequestData({ cxId, facilityId });
  const client = new QuestSftpClient({
    logLevel: "debug",
  });
  if (dryRun) {
    console.log("Dry run");
    console.log(requestData.patients.length, "patients");
  } else {
    const job = await client.sendBatchRequest(requestData);
    console.log("Sent job", job);
  }
}

export default program;
