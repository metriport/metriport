import { makeCommonWellAPI, metriportQueryMeta } from "../api";
import { oid } from "../../../shared/oid";
import { Patient } from "../../../models/medical/patient";
import { Organization } from "../../../models/medical/organization";
import { setCommonwellId } from "../patient-external-data";
import { patientWithCWData } from "./shared";

export const reset = async (patient: Patient, organization: Organization) => {
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
    const orgId = organization.id;
    const commonWell = makeCommonWellAPI(orgName, oid(orgId));

    await commonWell.resetPatientLink(metriportQueryMeta, cwPersonId, cwPatientId);

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
    throw new Error(msg);
  }
};
