import { CommonWellAPI } from "@metriport/commonwell-sdk";
import { reset } from ".";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { capture } from "../../../shared/notifications";
import { oid } from "../../../shared/oid";
import { makeCommonWellAPI, organizationQueryMeta } from "../api";
import { setCommonwellId } from "../patient-external-data";
import { getPatientData } from "../patient-shared";
import { autoUpgradeNetworkLinks, patientWithCWData } from "./shared";

const context = "cw.link.create";

export const create = async (
  personId: string,
  patientId: string,
  cxId: string,
  facilityId: string
): Promise<void> => {
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
    const orgId = organization.id;
    const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`
    commonWell = makeCommonWellAPI(orgName, oid(orgId));
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
    });

    if (!link._links?.self?.href) {
      throw new Error("Link has no href");
    }

    await autoUpgradeNetworkLinks(commonWell, queryMeta, cwPatientId, personId, context);
  } catch (error) {
    capture.error(error, {
      extra: { cwPatientId, personId, cwReference: commonWell?.lastReferenceHeader, context },
    });
    throw error;
  }
};
