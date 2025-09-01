import { PatientData } from "@metriport/core/domain/patient";
import { filterPatientLinks } from "@metriport/core/mpi/filter-patients/filter-patients";
import { strictMatchingAlgorithm } from "@metriport/core/mpi/match-patients";
import { isStrictMatchingAlgorithmEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { CwLink } from "../commonwell-v1/cw-patient-data";
import { cwLinkToPatientData } from "../commonwell-v1/link/shared";
import { cqLinkToPatientData } from "../carequality/shared";
import { CQLink } from "../carequality/cq-patient-data";

export async function validateCqLinksBelongToPatient(
  cxId: string,
  cqLinks: CQLink[],
  patientData: PatientData
): Promise<{ validNetworkLinks: CQLink[]; invalidLinks: CQLink[] }> {
  return validateLinksBelongToPatientGeneric<CQLink>(
    cxId,
    cqLinks,
    patientData,
    cqLinkToPatientData
  );
}

export async function validateCwLinksBelongToPatient(
  cxId: string,
  cwLinks: CwLink[],
  patientData: PatientData
): Promise<{ validNetworkLinks: CwLink[]; invalidLinks: CwLink[] }> {
  return validateLinksBelongToPatientGeneric<CwLink>(
    cxId,
    cwLinks,
    patientData,
    cwLinkToPatientData
  );
}

async function validateLinksBelongToPatientGeneric<TLink>(
  cxId: string,
  links: TLink[],
  patientData: PatientData,
  linkToPatientData: (link: TLink) => PatientData
): Promise<{ validNetworkLinks: TLink[]; invalidLinks: TLink[] }> {
  const linkToPatientDataMap = links.map(link => ({
    link,
    patientData: linkToPatientData(link),
  }));

  const { validPatientDataLinks, invalidPatientDataLinks } = await validateLinksBelongToPatient(
    cxId,
    patientData,
    linkToPatientDataMap.map(item => item.patientData)
  );

  const validNetworkLinks = linkToPatientDataMap
    .filter(item => validPatientDataLinks.includes(item.patientData))
    .map(item => item.link);

  const invalidLinks = linkToPatientDataMap
    .filter(item => invalidPatientDataLinks.includes(item.patientData))
    .map(item => item.link);

  return { validNetworkLinks, invalidLinks };
}

async function validateLinksBelongToPatient(
  cxId: string,
  patientData: PatientData,
  allPatientLinks: PatientData[]
): Promise<{ validPatientDataLinks: PatientData[]; invalidPatientDataLinks: PatientData[] }> {
  const isStrictMatchingAlgorithmEnabled = await isStrictMatchingAlgorithmEnabledForCx(cxId);

  if (isStrictMatchingAlgorithmEnabled) {
    const validNetworkLinks: PatientData[] = [];
    const invalidLinks: PatientData[] = [];

    for (const linkPatientData of allPatientLinks) {
      const isPatientMatch = strictMatchingAlgorithm(patientData, linkPatientData);
      if (isPatientMatch) {
        validNetworkLinks.push(linkPatientData);
      } else {
        invalidLinks.push(linkPatientData);
      }
    }

    return { validPatientDataLinks: validNetworkLinks, invalidPatientDataLinks: invalidLinks };
  } else {
    const linkStatuses = await filterPatientLinks(patientData, allPatientLinks);

    const validNetworkLinks: PatientData[] = [];
    const invalidLinks: PatientData[] = [];

    for (const linkStatus of linkStatuses) {
      if (linkStatus.isMatch) {
        validNetworkLinks.push(linkStatus.patient);
      } else {
        invalidLinks.push(linkStatus.patient);
      }
    }

    return { validPatientDataLinks: validNetworkLinks, invalidPatientDataLinks: invalidLinks };
  }
}
