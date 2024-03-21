import { organizationQueryMeta } from "@metriport/commonwell-sdk";
import { makeCommonWellAPI } from "../api";
import { oid } from "@metriport/core/domain/oid";
import { setCommonwellId } from "../patient-external-data";
import { patientWithCWData } from "./shared";
import { getPatientData } from "../patient-shared";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { isCWEnabledForCx } from "../../aws/appConfig";

export const reset = async (patientId: string, cxId: string, facilityId: string) => {
  if (!(await isCWEnabledForCx(cxId))) {
    console.log(`CW is disabled for cxId: ${cxId}`);
    return undefined;
  }

  const patient = await getPatientOrFail({ id: patientId, cxId });
  const { organization, facility } = await getPatientData(patient, facilityId);

  const externalData = patient.data.externalData;

  if (externalData === undefined || externalData.COMMONWELL === undefined) {
    throw new Error("Patient has no external data");
  }

  const patientCWExternalData = patientWithCWData(patient, externalData.COMMONWELL);
  const cwPatientId = patientCWExternalData.data.externalData.COMMONWELL.patientId;
  const cwPersonId = patientCWExternalData.data.externalData.COMMONWELL.personId;

  if (!cwPersonId) throw new Error(`No person id for patient: ${patient.id}`);

  try {
    const orgName = organization.data.name;
    const orgOID = organization.oid;
    const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`
    const commonWell = makeCommonWellAPI(orgName, oid(orgOID));
    const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

    await commonWell.resetPatientLink(queryMeta, cwPersonId, cwPatientId);

    await setCommonwellId({
      patientId: patient.id,
      cxId: patient.cxId,
      commonwellPatientId: cwPatientId,
      commonwellPersonId: undefined,
    });
  } catch (error) {
    const msg = `Failure resetting`;
    console.log(`${msg} - patient id:`, patient.id);
    console.log(msg, error);
    throw new Error(msg, { cause: error });
  }
};
