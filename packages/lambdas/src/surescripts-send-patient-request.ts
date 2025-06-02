import { capture } from "./shared/capture";
import { prefixedLog } from "./shared/log";
import { SurescriptsApi } from "@metriport/core/external/surescripts/api";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { getSurescriptSecrets } from "./shared/surescripts";
import { MetriportError } from "@metriport/shared";

capture.init();

interface SurescriptsSendPatientRequestEvent {
  cxId: string;
  facilityId: string;
  allPatients?: boolean;
  patientId?: string;
}

const log = prefixedLog("surescripts");

// Stub which will be integrated with Surescripts commands
export const handler = capture.wrapHandler(
  async ({ cxId, facilityId, allPatients, patientId }: SurescriptsSendPatientRequestEvent) => {
    const { surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword } =
      await getSurescriptSecrets();
    const client = new SurescriptsSftpClient({
      senderPassword: surescriptsSenderPassword,
      publicKey: surescriptsPublicKey,
      privateKey: surescriptsPrivateKey,
    });

    const api = new SurescriptsApi();
    const facility = await api.getFacilityData(cxId, facilityId);
    const transmission = client.createTransmission({
      cxId,
      npiNumber: facility.npi,
    });

    const patientIdsForFacility: string[] = [];
    if (allPatients) {
      const patientIds = await api.getPatientIds(cxId, facilityId);
      patientIdsForFacility.push(...patientIds);
    } else if (patientId) {
      patientIdsForFacility.push(patientId);
    } else throw new MetriportError("Invalid request");

    const patients = await api.getEachPatientById(cxId, patientIdsForFacility);
    if (patients.length === 0) {
      log(`No patients retrieved for facility ${facilityId}`);
      return;
    }

    const { content, requestedPatientIds: requested } = client.generatePatientLoadFile(
      transmission,
      patients
    );
    await client.writePatientLoadFileToS3(transmission, content);
    log(`Wrote ${requested.length} / ${patients.length} patients to S3 replica bucket`);
    log(`Transmission ID: ${transmission.id}`);
  }
);
