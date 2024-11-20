import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { getPatientOrFail } from "./get-patient";

export async function setHieOptOut({
  patient,
  optingOut,
}: {
  patient: PatientModel;
  optingOut: boolean;
}): Promise<Patient> {
  return patient.update({ optingOut });
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
