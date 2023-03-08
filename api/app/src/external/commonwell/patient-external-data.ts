import { getPatient } from "../../command/medical/patient/get-patient";
import NotFoundError from "../../errors/not-found";
import { PatientDataCommonwell } from "./patient-shared";
import { Patient } from "../../models/medical/patient";

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
  const updatedPatient = await getPatient({ id: patientId, cxId });

  const data = updatedPatient.data;
  data.externalData = {
    ...data.externalData,
    COMMONWELL: new PatientDataCommonwell(commonwellPatientId, commonwellPersonId),
  };

  const [count, rows] = await Patient.update(
    {
      data,
    },
    { where: { id: patientId, cxId }, returning: true }
  );
  if (count < 1) throw new NotFoundError();
  // TODO #156 Send this to Sentry
  if (count > 1) console.error(`Updated ${count} patients for id ${patientId} and cxId ${cxId}`);

  return rows[0];
};
