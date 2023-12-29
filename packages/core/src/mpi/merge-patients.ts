import { PatientDataMPI } from "./patient";
import { capture } from "../util/notifications";

export type MergeProtocol = (
  patients: PatientDataMPI[],
  currentPatient: PatientDataMPI
) => PatientDataMPI | undefined;

export function mergeWithFirstPatient(
  patients: PatientDataMPI[],
  currentPatient: PatientDataMPI
): PatientDataMPI | undefined {
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
