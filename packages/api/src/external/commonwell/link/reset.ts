import { CommonWellAPI, CommonwellError, organizationQueryMeta } from "@metriport/commonwell-sdk";
import { oid } from "@metriport/core/domain/oid";
import { out } from "@metriport/core/util/log";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { isCWEnabledForCx } from "../../aws/appConfig";
import { makeCommonWellAPI } from "../api";
import { setCommonwellIdsAndStatus } from "../patient-external-data";
import { getPatientData } from "../patient-shared";
import { patientWithCWData } from "./shared";

export async function reset(patientId: string, cxId: string, facilityId: string) {
  const context = "cw.link.reset";
  const { log } = out(context);
  if (!(await isCWEnabledForCx(cxId))) {
    log(`CW is disabled for cxId: ${cxId}`);
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

  let commonWell: CommonWellAPI | undefined;
  try {
    const orgName = organization.data.name;
    const orgOID = organization.oid;
    const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`
    commonWell = makeCommonWellAPI(orgName, oid(orgOID));
    const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

    await commonWell.resetPatientLink(queryMeta, cwPersonId, cwPatientId);

    await setCommonwellIdsAndStatus({
      patientId: patient.id,
      cxId: patient.cxId,
      commonwellPatientId: cwPatientId,
      commonwellPersonId: undefined,
      commonwellStatus: undefined,
      cqLinkStatus: undefined,
    });
  } catch (error) {
    const cwReference = commonWell?.lastReferenceHeader;
    const msg = `Failure resetting CW link`;
    log(`${msg} - patient id: ${patient.id}; cwReference ${cwReference}`);
    throw new CommonwellError(msg, error, {
      cwReference,
      context,
      patientId: patient.id,
      cwPersonId,
    });
  }
}
