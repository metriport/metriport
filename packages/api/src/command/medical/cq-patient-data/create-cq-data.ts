import { PatientCQData, PatientCQDataCreate } from "../../../domain/medical/cq-patient-data";
import { PatientCQDataModel } from "../../../models/medical/cq-patient-data";
import { getPatientCQData } from "./get-cq-data";
import { updatePatientCQData } from "./update-cq-data";

export async function createOrUpdatePatientCQData(
  cqData: PatientCQDataCreate
): Promise<PatientCQData> {
  const { id, cxId, data } = cqData;
  const patientCQData = {
    id,
    cxId,
    data,
  };

  const patientCQDataExists = await getPatientCQData({ id, cxId });
  if (patientCQDataExists) return updatePatientCQData(patientCQData);

  return await PatientCQDataModel.create(patientCQData);
}

export async function createCQData(cqData: PatientCQDataCreate): Promise<PatientCQData> {
  return await PatientCQDataModel.create(cqData);
}
