import { cloneDeep } from "lodash";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { Patient } from "../../models/medical/patient";
import { PatientDataCommonwell } from "./patient-shared";

export const setCommonwellId = async ({
  patientId,
  cxId,
  commonwellPatientId,
  commonwellPersonId,
}: {
  patientId: string;
  cxId: string;
  commonwellPatientId: string;
  commonwellPersonId: string | undefined;
}): Promise<Patient> => {
  const updatedPatient = await getPatientOrFail({ id: patientId, cxId });

  const updatedData = cloneDeep(updatedPatient.data);
  updatedData.externalData = {
    ...updatedData.externalData,
    COMMONWELL: new PatientDataCommonwell(commonwellPatientId, commonwellPersonId),
  };

  return updatedPatient.update({ data: updatedData });
};
