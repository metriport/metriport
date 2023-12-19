import NotFoundError from "../../../errors/not-found";
import { PatientCQDataModel } from "../../../models/medical/cq-patient-data";

export type GetCQData = { id: string; cxId: string };

export async function getPatientCQData({
  id,
  cxId,
}: GetCQData): Promise<PatientCQDataModel | undefined> {
  const patientCQData = await PatientCQDataModel.findOne({
    where: { cxId, id },
  });
  return patientCQData ?? undefined;
}

export async function getPatientCQDataOrFail(params: GetCQData): Promise<PatientCQDataModel> {
  const patientCQData = await getPatientCQData(params);
  if (!patientCQData)
    throw new NotFoundError(`Could not find patient's CQ data`, undefined, { id: params.id });
  return patientCQData;
}
