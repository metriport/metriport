import { Config } from "@metriport/core/util/config";
import { capture } from "./shared/capture";
import { prefixedLog } from "./shared/log";
import { SurescriptsApi } from "@metriport/core/external/sftp/surescripts/api";
import { SurescriptsSftpClient } from "@metriport/core/external/sftp/surescripts/client";
import { SurescriptsReplica } from "@metriport/core/external/sftp/surescripts/replica";
import { getSurescriptSecrets } from "./shared/surescripts";
import { GetPatientResponse } from "@metriport/core/external/sftp/api/get-patient";
import { FacilityResponse } from "@metriport/core/external/sftp/api/get-customer";
import { toSurescriptsPatientLoadFile } from "@metriport/core/external/sftp/surescripts/message";

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
    const api = new SurescriptsApi();
    const client = new SurescriptsSftpClient({
      production: Config.isCloudEnv(),
      senderPassword: surescriptsSenderPassword,
      publicKey: surescriptsPublicKey,
      privateKey: surescriptsPrivateKey,
    });
    const replica = new SurescriptsReplica({
      sftpClient: client,
      bucket: Config.getSurescriptsReplicaBucketName(),
    });

    const facility = await getFacilityById(cxId, facilityId);
    const transmission = client.createEnrollment({
      cxId,
      npiNumber: facility.npi,
    });

    const patientIdsForFacility: string[] = [];
    if (allPatients) {
      const { patientIds } = await api.getPatientIds(cxId, facilityId);
      patientIdsForFacility.push(...patientIds);
    } else if (patientId) {
      patientIdsForFacility.push(patientId);
    } else throw new Error("Invalid request");

    const patients = await getPatientsByIds(cxId, patientIdsForFacility);
    const file = toSurescriptsPatientLoadFile(client, transmission, patients);
    await replica.writePatientLoadFileToStorage(transmission, file);
    log(`Uploaded ${patients.length} patients to ${Config.getSurescriptsReplicaBucketName()}`);
    log(`Transmission ID: ${transmission.id}`);
  }
);

async function getFacilityById(cxId: string, facilityId: string): Promise<FacilityResponse> {
  const api = new SurescriptsApi();
  const customer = await api.getCustomer(cxId);
  if (!customer) throw new Error("Customer not found");
  const facility = customer.facilities.find(f => f.id === facilityId);
  if (!facility) throw new Error("Facility not found");
  return facility;
}

async function getPatientsByIds(cxId: string, patientIds: string[]): Promise<GetPatientResponse[]> {
  const api = new SurescriptsApi();
  const patients: GetPatientResponse[] = [];
  for (const patientId of patientIds) {
    const patient = await api.getPatient(cxId, patientId);
    if (patient) patients.push(patient);
  }
  return patients;
}
