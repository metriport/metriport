import {
  CQLink,
  PatientCQData,
  PatientCQDataCreate,
} from "../../../domain/medical/cq-patient-data";
import { PatientCQDataModel } from "../../../models/medical/cq-patient-data";
import { getPatientCQData } from "./get-cq-data";
import { updatePatientCQData } from "./update-cq-data";

export async function createOrUpdatePatientCQData({
  id,
  cxId,
  cqLinks,
}: {
  id: string;
  cxId: string;
  cqLinks: CQLink[];
}): Promise<PatientCQData | undefined> {
  if (!cqLinks.length) return;
  const patientCQData: PatientCQDataCreate = {
    id,
    cxId,
    data: { links: cqLinks },
  };

  const patientCQDataExists = await getPatientCQData({ id, cxId });
  if (patientCQDataExists) return updatePatientCQData(patientCQData);

  return await PatientCQDataModel.create(patientCQData);
}

export async function createCQData(cqData: PatientCQDataCreate): Promise<PatientCQData> {
  return await PatientCQDataModel.create(cqData);
}
