import { CommonWellAPI, organizationQueryMeta, RequestMetadata } from "@metriport/commonwell-sdk";
import { addOidPrefix } from "@metriport/core/domain/oid";
import { Patient } from "@metriport/core/domain/patient";
import { makeCommonWellAPI } from "../api";
import { getCWData } from "../patient";
import { getCwInitiator } from "../shared";

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

  const initiator = await getCwInitiator(patient, facilityId);
  const initiatorName = initiator.name;
  const initiatorOID = initiator.oid;
  const initiatorNpi = initiator.npi;

  const commonWell = makeCommonWellAPI(initiatorName, addOidPrefix(initiatorOID));
  const queryMeta = organizationQueryMeta(initiatorName, { npi: initiatorNpi });

  return {
    commonWell,
    queryMeta,
    cwPatientId,
    cwPersonId,
    orgOID: initiatorOID,
    orgName: initiatorName,
  };
}
