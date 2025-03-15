import { PatientSettingsModel } from "../../models/patient-settings";

export async function deletePatientSettings({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<void> {
  await PatientSettingsModel.destroy({
    where: { cxId, patientId },
  });
}
