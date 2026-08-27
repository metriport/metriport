import { BaseUpdateCmdWithCustomer } from "../../../../command/medical/base-update-command";
import { EhexPatientDataModel } from "../../models/ehex-patient-data";

export type EhexPatientDataDelete = BaseUpdateCmdWithCustomer;

export async function deleteEhexPatientData(patientDelete: EhexPatientDataDelete): Promise<void> {
  const { id, cxId } = patientDelete;
  await EhexPatientDataModel.destroy({ where: { id, cxId } });
}
