import { Config } from "@metriport/core/util/config";
import { capture } from "./shared/capture";
import { prefixedLog } from "./shared/log";
import { SurescriptsApi } from "@metriport/core/external/sftp/surescripts/api";
import { SurescriptsSftpClient } from "@metriport/core/external/sftp/surescripts/client";
import { SurescriptsReplica } from "@metriport/core/external/sftp/surescripts/replica";
import { getSurescriptSecrets } from "./shared/surescripts";
import { GetPatientResponse, FacilityResponse } from "@metriport/core/external/sftp/api/shared";
import { toSurescriptsPatientLoadFile } from "@metriport/core/external/sftp/surescripts/message";
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
      const patientIds = await getPatientIdsForFacility(cxId, facilityId);
      patientIdsForFacility.push(...patientIds);
    } else if (patientId) {
      patientIdsForFacility.push(patientId);
    } else throw new MetriportError("Invalid request");

    const patients = await getPatientsByIds(cxId, patientIdsForFacility);
    if (patients.length === 0) {
      log(`No patients found for facility ${facilityId}`);
      return;
    }

    const file = toSurescriptsPatientLoadFile(client, transmission, patients);
    await replica.writePatientLoadFileToStorage(transmission, file);
    log(`Uploaded ${patients.length} patients to ${Config.getSurescriptsReplicaBucketName()}`);
    log(`Transmission ID: ${transmission.id}`);
  }
);

async function getFacilityById(cxId: string, facilityId: string): Promise<FacilityResponse> {
  const api = new SurescriptsApi();
  const customer = await api.getCustomer(cxId);
  if (!customer)
    throw new MetriportError("Customer not found", "customer_not_found", { cxId, facilityId });
  const facility = customer.facilities.find(f => f.id === facilityId);
  if (!facility)
    throw new MetriportError("Facility not found", "facility_not_found", { cxId, facilityId });
  return facility;
}

async function getPatientIdsForFacility(cxId: string, facilityId: string): Promise<string[]> {
  const api = new SurescriptsApi();
  const { patientIds } = await api.getPatientIds(cxId, facilityId);
  return patientIds;
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
