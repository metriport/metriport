import { CommonWellAPI, organizationQueryMeta } from "@metriport/commonwell-sdk";
import { addOidPrefix } from "@metriport/core/domain/oid";
import { out } from "@metriport/core/util/log";
import { reset } from ".";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { capture } from "../../../shared/notifications";
import { isCWEnabledForCx } from "../../aws/appConfig";
import { makeCommonWellAPI } from "../api";
import { setCommonwellIds, setPatientDiscoveryStatus } from "../patient-external-data";
import { getCwInitiator } from "../shared";
import { autoUpgradeNetworkLinks, patientWithCWData } from "./shared";

const context = "cw.link.create";

export async function create(
  personId: string,
  patientId: string,
  cxId: string,
  facilityId: string,
  getOrgIdExcludeList: () => Promise<string[]>
): Promise<void> {
  const { log } = out(context);

  if (!(await isCWEnabledForCx(cxId))) {
    log(`CW is disabled for cxId: ${cxId}`);
    return undefined;
  }

  const patient = await getPatientOrFail({ id: patientId, cxId });
  const initiator = await getCwInitiator(patient, facilityId);

  const externalData = patient.data.externalData;

  if (externalData === undefined || externalData.COMMONWELL === undefined) {
    throw new Error(`No external data for patient: ${patient.id}`);
  }

  const patientCWExternalData = patientWithCWData(patient, externalData.COMMONWELL);
  const cwPatientId = patientCWExternalData.data.externalData.COMMONWELL.patientId;
  const cwPersonId = patientCWExternalData.data.externalData.COMMONWELL.personId;

  let commonWell: CommonWellAPI | undefined;
  try {
    if (cwPersonId === personId) {
      return;
    }

    if (cwPersonId) {
      await reset(patientId, cxId, facilityId);
    }

    commonWell = makeCommonWellAPI(initiator.name, addOidPrefix(initiator.oid));
    const queryMeta = organizationQueryMeta(initiator.name, { npi: initiator.npi });

    const cwPatient = await commonWell.getPatient(queryMeta, cwPatientId);

    if (!cwPatient._links?.self?.href) {
      throw new Error(`No patient uri for cw patient: ${cwPatientId}`);
    }

    const link = await commonWell.addPatientLink(queryMeta, personId, cwPatient._links.self.href);

    await setCommonwellIds({
      patientId: patient.id,
      cxId: patient.cxId,
      commonwellPatientId: cwPatientId,
      commonwellPersonId: personId,
    });
    await setPatientDiscoveryStatus({
      patientId: patient.id,
      cxId: patient.cxId,
      status: "completed",
    });

    if (!link._links?.self?.href) {
      throw new Error("Link has no href");
    }

    await autoUpgradeNetworkLinks(
      commonWell,
      queryMeta,
      cwPatientId,
      personId,
      context,
      getOrgIdExcludeList
    );
  } catch (error) {
    const msg = `Failed to create CW person link`;
    log(`${msg}. Cause: ${error}`);
    capture.message(msg, {
      extra: { cwPatientId, personId, cwReference: commonWell?.lastReferenceHeader, context },
      level: "error",
    });
    throw error;
  }
}
