import { Command } from "commander";
import { QuestSftpClient } from "@metriport/core/external/quest/client";
import { QuestApi } from "@metriport/core/external/quest/api";

const sendRequest = new Command();
sendRequest.name("request");
sendRequest.option("--local", "Whether to use a local replica");
sendRequest.option("--local-path", "The local directory to write the replica");
sendRequest.option("--cx-id <cxId>", "The ID of the customer");
sendRequest.option("--facility-id <facilityId>", "The ID of the facility");
sendRequest.option("--patient-id <patientId>", "Optional specific patient IDs");

sendRequest.action(async () => {
  const { local, localPath, cxId, facilityId, patientId } = sendRequest.opts<{
    local?: boolean;
    localPath?: string;
    cxId?: string;
    facilityId?: string;
    patientId?: string;
  }>();
  if (!cxId) throw new Error("cxId is required");
  if (!facilityId) throw new Error("facilityId is required");

  console.log("Gathering data...");
  const api = new QuestApi();
  const requestData = await api.getRequestData(
    cxId,
    facilityId,
    patientId ? patientId.split(",") : undefined
  );

  console.log("Generating request file...");
  const client = new QuestSftpClient({
    local,
    localPath,
  });
  await client.generateAndWriteRequestFile(requestData);
  console.log("Request file generated and written to replica");
});

export default sendRequest;
