import { normalizePatientInboundMpi } from "@metriport/core/mpi/normalize-patient";
import { PatientData } from "@metriport/core/domain/patient";
import { epicMatchingAlgorithm } from "@metriport/core/mpi/match-patients";

const SIMILARITY_THRESHOLD = 8.5;

// TODO #2641 this is a temporary solution to validate the links belong to the patient
// we need to create a more robust solution to validate the links belong to the patient
export async function validateLinksBelongToPatient<NetworkLink>(
  networkLinks: NetworkLink[],
  patientData: PatientData,
  linkToPatientData: (link: NetworkLink) => PatientData
): Promise<NetworkLink[]> {
  const validNetworkLinks: NetworkLink[] = [];

  for (const networkLink of networkLinks) {
    const linkPatientData = linkToPatientData(networkLink);
    const normalizedLinkPatient = normalizePatientInboundMpi(linkPatientData);
    const normalizedPatient = normalizePatientInboundMpi(patientData);

    const isPatientMatch = epicMatchingAlgorithm(
      normalizedPatient,
      normalizedLinkPatient,
      SIMILARITY_THRESHOLD
    );

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
