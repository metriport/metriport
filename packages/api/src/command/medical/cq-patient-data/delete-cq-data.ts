import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getPatientCQData } from "./get-cq-data";

export type PatientCQDataDelete = BaseUpdateCmdWithCustomer;

export async function deletePatientCQData(patientDelete: PatientCQDataDelete): Promise<void> {
  const { id, cxId } = patientDelete;
  const cqData = await getPatientCQData({ id, cxId });
  if (!cqData) return;
  await cqData.destroy();
}
