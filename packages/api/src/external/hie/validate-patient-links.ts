import { normalizePatientInboundMpi } from "@metriport/core/mpi/normalize-patient";
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
): Promise<NetworkLink[]> {
  const validNetworkLinks: NetworkLink[] = [];

  for (const networkLink of networkLinks) {
    const linkPatientData = linkToPatientData(networkLink);
    const normalizedLinkPatient = normalizePatientInboundMpi(linkPatientData);
    const normalizedPatient = normalizePatientInboundMpi(patientData);

    const isStrictMatchingAlgorithmEnabled = await isStrictMatchingAlgorithmEnabledForCx(cxId);

    let isPatientMatch = false;

    if (isStrictMatchingAlgorithmEnabled) {
      isPatientMatch = strictMatchingAlgorithm(normalizedPatient, normalizedLinkPatient);
    } else {
      isPatientMatch = epicMatchingAlgorithm(
        normalizedPatient,
        normalizedLinkPatient,
        SIMILARITY_THRESHOLD
      );
    }

    if (isPatientMatch) {
      validNetworkLinks.push(networkLink);
    } else {
      validNetworkLinks.push({
        ...networkLink,
        isInvalid: true,
      });
    }
  }

  return validNetworkLinks;
}
