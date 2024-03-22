import { CommonWellAPI, organizationQueryMeta } from "@metriport/commonwell-sdk";
import { reset } from ".";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { capture } from "../../../shared/notifications";
import { oid } from "@metriport/core/domain/oid";
import { makeCommonWellAPI } from "../api";
import { setCommonwellId } from "../patient-external-data";
import { getPatientData } from "../patient-shared";
import { autoUpgradeNetworkLinks, patientWithCWData } from "./shared";
import { isCWEnabledForCx } from "../../aws/appConfig";

const context = "cw.link.create";

export const create = async (
  personId: string,
  patientId: string,
  cxId: string,
  facilityId: string,
  orgIdExcludeList: Set<string>
): Promise<void> => {
  if (!(await isCWEnabledForCx(cxId))) {
    console.log(`CW is disabled for cxId: ${cxId}`);
    return undefined;
  }

  const patient = await getPatientOrFail({ id: patientId, cxId });
  const { organization, facility } = await getPatientData(patient, facilityId);

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

    const orgName = organization.data.name;
    const orgOID = organization.oid;
    const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`
    commonWell = makeCommonWellAPI(orgName, oid(orgOID));
    const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

    const cwPatient = await commonWell.getPatient(queryMeta, cwPatientId);

    if (!cwPatient._links?.self?.href) {
      throw new Error(`No patient uri for cw patient: ${cwPatientId}`);
    }

    const link = await commonWell.addPatientLink(queryMeta, personId, cwPatient._links.self.href);

    await setCommonwellId({
      patientId: patient.id,
      cxId: patient.cxId,
      commonwellPatientId: cwPatientId,
      commonwellPersonId: personId,
      commonwellStatus: "completed",
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
      orgIdExcludeList
    );
  } catch (error) {
    const msg = `Failed to create CW person link`;
    console.log(`${msg}. Cause: ${error}`);
    capture.message(msg, {
      extra: { cwPatientId, personId, cwReference: commonWell?.lastReferenceHeader, context },
      level: "error",
    });
    throw error;
  }
};
