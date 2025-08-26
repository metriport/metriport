import { isStrictMatchingAlgorithmEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { PatientData } from "@metriport/core/domain/patient";
import { epicMatchingAlgorithm, strictMatchingAlgorithm } from "@metriport/core/mpi/match-patients";
import { CQLink } from "../carequality/cq-patient-data";
import { cqLinkToPatientData } from "../carequality/shared";

const SIMILARITY_THRESHOLD = 8.5;

// TODO #2641 this is a temporary solution to validate the links belong to the patient
// we need to create a more robust solution to validate the links belong to the patient
export async function validateCqLinksBelongToPatient(
  cxId: string,
  cqLinks: CQLink[],
  patientData: PatientData
): Promise<{ validNetworkLinks: CQLink[]; invalidLinks: CQLink[] }> {
  const validNetworkLinks: CQLink[] = [];
  const invalidLinks: CQLink[] = [];

  for (const cqLink of cqLinks) {
    const linkPatientData = cqLinkToPatientData(cqLink);

    const isPatientMatch = await validateLinkBelongsToPatient(cxId, linkPatientData, patientData);

    if (isPatientMatch) {
      validNetworkLinks.push(cqLink);
    } else {
      invalidLinks.push(cqLink);
    }
  }

  return { validNetworkLinks, invalidLinks };
}

export async function validateCwLinksBelongToPatient<T>(
  cxId: string,
  cwLinks: T[],
  patientData: PatientData,
  convertToPatientData: (cwLink: T) => PatientData
): Promise<{ validNetworkLinks: T[]; invalidLinks: T[] }> {
  const validNetworkLinks: T[] = [];
  const invalidLinks: T[] = [];

  for (const cwLink of cwLinks) {
    const linkPatientData = convertToPatientData(cwLink);

    const isPatientMatch = await validateLinkBelongsToPatient(cxId, linkPatientData, patientData);

    if (isPatientMatch) {
      validNetworkLinks.push(cwLink);
    } else {
      invalidLinks.push(cwLink);
    }
  }

  return { validNetworkLinks, invalidLinks };
}

const validateLinkBelongsToPatient = async (
  cxId: string,
  linkPatientData: PatientData,
  patientData: PatientData
): Promise<boolean> => {
  const isStrictMatchingAlgorithmEnabled = await isStrictMatchingAlgorithmEnabledForCx(cxId);

  let isPatientMatch = false;

  if (isStrictMatchingAlgorithmEnabled) {
    isPatientMatch = strictMatchingAlgorithm(patientData, linkPatientData);
  } else {
    isPatientMatch = epicMatchingAlgorithm(patientData, linkPatientData, SIMILARITY_THRESHOLD);
  }

  return isPatientMatch;
};
