import { Patient, PatientData } from "../domain/patient/patient";
import { capture } from "../util/notifications";
import { PatientMPI } from "./shared";

export type MergeProtocol = (patients: Patient[], currentPatient: Patient) => Patient | undefined;

export function mergeWithFirstPatient(
  patients: PatientMPI[],
  currentPatient: PatientData
): PatientMPI | undefined {
  if (patients.length === 0) return undefined;
  if (patients.length === 1) return patients[0];

  const chosenOne = patients[0];
  const msg = `Found more than one patient with the same demo`;
  const dynamicMsg = `${msg}, chose ${chosenOne?.id} - list ${patients
    .map(p => p.id)
    .join(", ")} - demo: ${currentPatient}`;
  console.log(dynamicMsg);

  capture.message(msg, {
    level: "warning",
    extra: {
      chosenOne: chosenOne?.id,
      demographics: currentPatient,
      patients: patients.map(p => ({ id: p.id, data: p })),
    },
  });
  return chosenOne;
}
