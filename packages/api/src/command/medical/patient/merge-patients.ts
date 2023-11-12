import { Patient, PatientData } from "../../../domain/medical/patient";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";

export type MergeProtocol = (patients: Patient[], demo: PatientData, cxid: string) => Patient;

export const mergeWithFirstPatient: MergeProtocol = (patients, demo, cxId) => {
  const { log } = Util.out(`getPatientByDemo - cxId ${cxId}`);
  const chosenOne = patients[0];

  const msg = `Found more than one patient with the same demo`;
  log(`${msg}, chose ${chosenOne.id} - list ${patients.map(p => p.id).join(", ")} - demo: `, demo);
  capture.message(msg, {
    extra: {
      chosenOne: chosenOne.id,
      demographics: demo,
      patients: patients.map(p => ({ id: p.id, data: p.data })),
    },
  });

  return chosenOne;
};

export const mergePatients = async (
  mergeProtocol: MergeProtocol,
  patients: Patient[],
  demo: PatientData,
  cxId: string
): Promise<Patient | null> => {
  if (patients.length === 0) return null;
  if (patients.length === 1) return patients[0];

  return mergeProtocol(patients, demo, cxId);
};
