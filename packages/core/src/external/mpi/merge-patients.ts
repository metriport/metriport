import { PatientDataMPI } from "./patient-incoming-schema";
import { capture } from "../../util/notifications";

export type MergeProtocol = (
  patients: PatientDataMPI[],
  demo: PatientDataMPI,
  cxid?: string
) => PatientDataMPI | undefined;

export const mergeWithFirstPatient: MergeProtocol = (patients, demo) => {
  const chosenOne = patients[0];
  const msg = `Found more than one patient with the same demo, chose ${
    chosenOne?.id
  } - list ${patients.map(p => p.id).join(", ")} - demo: ${demo}`;
  console.log(msg);
  capture.message(msg, {
    extra: {
      chosenOne: chosenOne?.id,
      demographics: demo,
      patients: patients.map(p => ({ id: p.id, data: p })),
    },
  });

  return chosenOne;
};

export const mergePatients = async (
  mergeProtocol: MergeProtocol,
  patients: PatientDataMPI[],
  demo: PatientDataMPI,
  cxId?: string
): Promise<PatientDataMPI | undefined> => {
  if (patients.length === 0) return undefined;
  if (patients.length === 1) return patients[0];

  return mergeProtocol(patients, demo, cxId);
};
