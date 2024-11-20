import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getPatientOrFail } from "./get-patient";

export async function optingPatientInOrOut({
  cxId,
  patientId,
  optingOut,
}: {
  cxId: string;
  patientId: string;
  optingOut: boolean;
}): Promise<Patient> {
  const result = await executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientOrFail({
      id: patientId,
      cxId,
      lock: true,
      transaction,
    });

    return patient.update({ optingOut }, { transaction });
  });

  return result;
}

export async function isPatientOptingOut({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<boolean> {
  const patient = await getPatientOrFail({ id: patientId, cxId });

  return patient.optingOut || false;
}
