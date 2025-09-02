import { CommonWellAPI } from "@metriport/commonwell-sdk";
import { Patient } from "@metriport/core/domain/patient";
import { getCWData } from "../../commonwell/patient/patient";
import { getCwInitiator } from "../../commonwell/shared";
import { makeCommonWellAPI } from "../api";

export type CWAccessV2 =
  | {
      commonWell: CommonWellAPI;
      orgOID: string;
      orgName: string;
      cwPatientId: string;
      error?: never;
    }
  | {
      error: string;
    };

export async function getCWAccessForPatient(patient: Patient): Promise<CWAccessV2> {
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

  const initiator = await getCwInitiator(patient, facilityId);
  const initiatorName = initiator.name;
  const initiatorOID = initiator.oid;
  const initiatorNpi = initiator.npi;

  const commonWell = makeCommonWellAPI(initiatorName, initiatorOID, initiatorNpi);

  return {
    commonWell,
    cwPatientId,
    orgOID: initiatorOID,
    orgName: initiatorName,
  };
}
