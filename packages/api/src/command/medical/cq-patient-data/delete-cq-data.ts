import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getPatientCQDataOrFail } from "./get-cq-data";

export type PatientCQDataDelete = BaseUpdateCmdWithCustomer;

export async function deletePatientCQData(patientDelete: PatientCQDataDelete): Promise<void> {
  const { id, cxId, eTag } = patientDelete;

  const cqData = await getPatientCQDataOrFail({ id, cxId });
  validateVersionForUpdate(cqData, eTag);

  await cqData.destroy();
}
