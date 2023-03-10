import { makeCommonWellAPI, metriportQueryMeta } from "../api";
import { oid } from "../../../shared/oid";
import { Patient } from "../../../models/medical/patient";
import { Organization } from "../../../models/medical/organization";
import { PatientDataCommonwell } from "../patient-shared";
import { setCommonwellId } from "../patient-external-data";
import { createPatientLink } from "./shared";

export const reset = async (patient: Patient, organization: Organization) => {
  if (!patient.data.externalData?.COMMONWELL) {
    throw new Error("Patient has no external data");
  }

  const patientCWExternalData = patient.data.externalData.COMMONWELL as PatientDataCommonwell;
  const cwPatientId = patientCWExternalData.patientId;
  const cwPersonId = patientCWExternalData.personId;

  if (!cwPersonId) throw new Error(`No person id for patient: ${cwPatientId}`);

  try {
    const referenceLink = createPatientLink(cwPersonId, cwPatientId);

    const orgName = organization.data.name;
    const orgId = organization.id;
    const commonWell = makeCommonWellAPI(orgName, oid(orgId));

    await commonWell.resetPatientLink(metriportQueryMeta, `${referenceLink}/`);

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
