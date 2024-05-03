import { CommonWellAPI, CommonwellError, organizationQueryMeta } from "@metriport/commonwell-sdk";
import { addOidPrefix } from "@metriport/core/domain/oid";
import { out } from "@metriport/core/util/log";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { isCWEnabledForCx } from "../../aws/appConfig";
import { makeCommonWellAPI } from "../api";
import { setCommonwellIds } from "../patient-external-data";
import { getCwInitiator } from "../shared";
import { patientWithCWData } from "./shared";

export async function reset(patientId: string, cxId: string, facilityId: string) {
  const context = "cw.link.reset";
  const { log } = out(context);
  if (!(await isCWEnabledForCx(cxId))) {
    log(`CW is disabled for cxId: ${cxId}`);
    return undefined;
  }

  const patient = await getPatientOrFail({ id: patientId, cxId });
  const initiator = await getCwInitiator(patient, facilityId);

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
    commonWell = makeCommonWellAPI(initiator.name, addOidPrefix(initiator.oid));
    const queryMeta = organizationQueryMeta(initiator.name, { npi: initiator.npi });

    await commonWell.resetPatientLink(queryMeta, cwPersonId, cwPatientId);

    await setCommonwellIds({
      patientId: patient.id,
      cxId: patient.cxId,
      commonwellPatientId: cwPatientId,
      commonwellPersonId: undefined,
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
