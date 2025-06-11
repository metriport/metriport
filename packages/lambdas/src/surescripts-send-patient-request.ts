import { capture } from "./shared/capture";
import { prefixedLog } from "./shared/log";
import { SurescriptsApi } from "@metriport/core/external/surescripts/api";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { getSurescriptSecrets } from "./shared/surescripts";
import { SurescriptsRequestEvent } from "@metriport/core/external/surescripts/types";

capture.init();
const log = prefixedLog("surescripts");

// Stub which will be integrated with Surescripts commands
export const handler = capture.wrapHandler(async (event: SurescriptsRequestEvent) => {
  const { surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword } =
    await getSurescriptSecrets();
  const client = new SurescriptsSftpClient({
    senderPassword: surescriptsSenderPassword,
    publicKey: surescriptsPublicKey,
    privateKey: surescriptsPrivateKey,
  });

  const api = new SurescriptsApi();

  const requestData = await api.getRequestData(event);

  if (requestData.patients.length === 0) {
    log(`No patients retrieved for facility ${requestData.facility.id}`);
    return;
  }

  log(`Sending patient request to Surescripts...`);
  const { requestedPatientIds, requestFileName, transmissionId } =
    await client.generateAndWriteRequestFileToS3(requestData);

  log(
    `Wrote ${requestedPatientIds.length} / ${requestData.patients.length} patients to S3 replica bucket`
  );
  log(`Transmission ID: ${transmissionId}`);
  log(`Request file name: ${requestFileName}`);
});
