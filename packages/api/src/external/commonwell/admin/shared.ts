import { CommonWellAPI, organizationQueryMeta, RequestMetadata } from "@metriport/commonwell-sdk";
import { oid } from "@metriport/core/domain/oid";
import { Patient } from "@metriport/core/domain/patient";
import { makeCommonWellAPI } from "../api";
import { getCWData } from "../patient";
import { getPatientData } from "../patient-shared";

export type CWAccess =
  | {
      commonWell: CommonWellAPI;
      queryMeta: RequestMetadata;
      orgOID: string;
      orgName: string;
      cwPatientId: string;
      cwPersonId: string | undefined;
      error?: never;
    }
  | {
      error: string;
    };

export async function getCWAccessForPatient(patient: Patient): Promise<CWAccess> {
  const facilityId = patient.facilityIds[0];
  if (!facilityId) {
    console.log(`Patient ${patient.id} has no facilityId, skipping...`);
    return { error: "missing-facility-id" };
  }
  const commonwellData = patient.data.externalData
    ? getCWData(patient.data.externalData)
    : undefined;
  if (!commonwellData) {
    console.log(`Patient ${patient.id} has no externalData for CommonWell, skipping...`);
    return { error: "missing-external-data" };
  }
  const cwPatientId = commonwellData.patientId;
  const cwPersonId = commonwellData.personId;

  // Get Org info to setup API access
  const { organization, facility } = await getPatientData(patient, facilityId);
  const orgName = organization.data.name;
  const orgOID = organization.oid;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`

  const commonWell = makeCommonWellAPI(orgName, oid(orgOID));
  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

  return { commonWell, queryMeta, cwPatientId, cwPersonId, orgOID, orgName };
}
