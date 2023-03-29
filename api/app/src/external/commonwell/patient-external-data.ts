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
  const query = { id: patientId, cxId };
  const updatedPatient = await getPatientOrFail(query);

  const data = updatedPatient.data;
  data.externalData = {
    ...data.externalData,
    COMMONWELL: new PatientDataCommonwell(commonwellPatientId, commonwellPersonId),
  };

  return updatedPatient.update({ data }, { where: { ...query, eTag: updatedPatient.eTag } });
};
