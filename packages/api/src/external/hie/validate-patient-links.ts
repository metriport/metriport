import { PatientData } from "@metriport/core/domain/patient";
import { epicMatchingAlgorithm, strictMatchingAlgorithm } from "@metriport/core/mpi/match-patients";
import { isStrictMatchingAlgorithmEnabledForCx } from "@metriport/core/external/aws/app-config";

const SIMILARITY_THRESHOLD = 8.5;

// TODO #2641 this is a temporary solution to validate the links belong to the patient
// we need to create a more robust solution to validate the links belong to the patient
export async function validateLinksBelongToPatient<NetworkLink>(
  cxId: string,
  networkLinks: NetworkLink[],
  patientData: PatientData,
  linkToPatientData: (link: NetworkLink) => PatientData
): Promise<{ validNetworkLinks: NetworkLink[]; invalidLinks: NetworkLink[] }> {
  const validNetworkLinks: NetworkLink[] = [];
  const invalidLinks: NetworkLink[] = [];

  for (const networkLink of networkLinks) {
    const linkPatientData = linkToPatientData(networkLink);

    const isStrictMatchingAlgorithmEnabled = await isStrictMatchingAlgorithmEnabledForCx(cxId);

    let isPatientMatch = false;

    if (isStrictMatchingAlgorithmEnabled) {
      isPatientMatch = strictMatchingAlgorithm(patientData, linkPatientData);
    } else {
      isPatientMatch = epicMatchingAlgorithm(patientData, linkPatientData, SIMILARITY_THRESHOLD);
    }

    if (isPatientMatch) {
      validNetworkLinks.push(networkLink);
    } else {
      invalidLinks.push(networkLink);
    }
  }

  return { validNetworkLinks, invalidLinks };
}
