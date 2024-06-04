import { BaseUpdateCmdWithCustomer } from "../../../../command/medical/base-update-command";
import { getCQPatientData } from "./get-cq-data";

export type CQPatientDataDelete = BaseUpdateCmdWithCustomer;

export async function deleteCQPatientData(patientDelete: CQPatientDataDelete): Promise<void> {
  const { id, cxId } = patientDelete;
  const cqData = await getCQPatientData({ id, cxId, lock: true });
  if (!cqData) return;
  await cqData.destroy();
}
