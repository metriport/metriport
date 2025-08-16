import { BaseUpdateCmdWithCustomer } from "../../../../command/medical/base-update-command";
import { getCwPatientData } from "./get-cw-data";

export type CwPatientDataDelete = BaseUpdateCmdWithCustomer;

export async function deleteCwPatientData(patientDelete: CwPatientDataDelete): Promise<void> {
  const { id, cxId } = patientDelete;
  const cwData = await getCwPatientData({ id, cxId });
  if (!cwData) return;
  await cwData.destroy();
}
