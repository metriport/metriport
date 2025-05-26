import { Config } from "@metriport/core/util/config";
import { capture } from "./shared/capture";
import { prefixedLog } from "./shared/log";
import { SurescriptsApi } from "@metriport/core/external/sftp/surescripts/api";
import { SurescriptsSftpClient } from "@metriport/core/external/sftp/surescripts/client";
import { SurescriptsReplica } from "@metriport/core/external/sftp/surescripts/replica";
import { getSurescriptSecrets } from "./shared/surescripts";
import { GetPatientResponse } from "@metriport/core/external/sftp/api/get-patient";
import { toSurescriptsPatientLoadFile } from "@metriport/core/external/sftp/surescripts/message";

capture.init();

interface SurescriptsSendPatientRequestEvent {
  cxId: string;
  facilityId?: string | undefined;
  allPatients?: boolean;
  patientId?: string;
}

const log = prefixedLog("surescripts");

// Stub which will be integrated with Surescripts commands
export const handler = capture.wrapHandler(
  async ({ cxId, facilityId, allPatients, patientId }: SurescriptsSendPatientRequestEvent) => {
    const { surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword } =
      await getSurescriptSecrets();
    const api = new SurescriptsApi();
    const client = new SurescriptsSftpClient({
      production: Config.isCloudEnv(),
      senderPassword: surescriptsSenderPassword,
      publicKey: surescriptsPublicKey,
      privateKey: surescriptsPrivateKey,
    });

    const customer = await api.getCustomer(cxId);
    if (!customer) throw new Error("Customer not found");
    const facility = customer.facilities.find(f => f.id === facilityId);
    if (!facility) throw new Error("Facility not found");

    const replica = new SurescriptsReplica({
      sftpClient: client,
      bucket: Config.getSurescriptsReplicaBucketName(),
    });
    const transmission = client.createEnrollment({
      cxId,
      npiNumber: facility.npi,
    });

    if (allPatients) {
      const { patientIds } = await api.getPatientIds(cxId, facilityId);
      const patients: GetPatientResponse[] = [];
      for (const patientId of patientIds) {
        const patient = await api.getPatient(cxId, patientId);
        if (patient) patients.push(patient);
      }
      const file = toSurescriptsPatientLoadFile(client, transmission, patients);
      await replica.writePatientLoadFileToStorage(transmission, file);
      log(`Uploaded ${patients.length} patients to ${Config.getSurescriptsReplicaBucketName()}`);
    } else if (patientId) {
      const patient = await api.getPatient(cxId, patientId);
      if (!patient) throw new Error("Patient not found");
      const file = toSurescriptsPatientLoadFile(client, transmission, [patient]);
      await replica.writePatientLoadFileToStorage(transmission, file);
      log(`Uploaded patient ${patient.id} to ${Config.getSurescriptsReplicaBucketName()}`);
    } else throw new Error("Invalid request");

    log(`Transmission ID: ${transmission.id}`);
  }
);
