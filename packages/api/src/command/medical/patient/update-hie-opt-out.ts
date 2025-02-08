import { Patient } from "@metriport/core/domain/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { PatientModel } from "../../../models/medical/patient";
import { getPatientModelOrFail, getPatientOrFail } from "./get-patient";

export async function setHieOptOut({
  cxId,
  patientId,
  hieOptOut,
}: {
  cxId: string;
  patientId: string;
  hieOptOut: boolean;
}): Promise<Patient> {
  const patient = await executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientModelOrFail({
      id: patientId,
      cxId,
      lock: true,
      transaction,
    });

    return patient.update({ hieOptOut }, { transaction });
  });
  return patient.dataValues;
}

export async function getHieOptOut({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<boolean> {
  const patient = await getPatientOrFail({ id: patientId, cxId });

  return patient.hieOptOut || false;
}
