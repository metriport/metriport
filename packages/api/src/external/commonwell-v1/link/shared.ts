import {
  CommonWellAPI,
  isLOLA1,
  isLOLA2,
  isLOLA3,
  NetworkLink,
  Person,
  RequestMetadata,
} from "@metriport/commonwell-sdk-v1";
import { CwLink } from "../cw-patient-data";
import { errorToString } from "@metriport/core/util/error/shared";
import { USStateForAddress } from "@metriport/shared/dist/domain/address";
import {
  Patient,
  PatientData,
  PatientExternalData,
  PatientExternalDataEntry,
  GenderAtBirth,
} from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { buildDayjs, ISO_DATE } from "@metriport/shared/common/date";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { filterTruthy } from "../../../shared/filter-map-utils";
import { PatientDataCommonwell } from "../patient-shared";
const urnOidRegex = /^urn:oid:/;

export const commonwellPersonLinks = (persons: Person[]): Person[] => {
  return persons.flatMap<Person>(filterTruthy);
};

export type PatientWithCW = Omit<Patient, "data"> & {
  data: Omit<PatientData, "externalData"> & {
    externalData: Omit<PatientExternalData, "COMMONWELL"> & {
      [MedicalDataSource.COMMONWELL]: PatientDataCommonwell;
    };
  };
};

export function patientWithCWData(
  patient: Patient,
  cwEntry: PatientExternalDataEntry
): PatientWithCW {
  const patientWithCW: PatientWithCW = Object.assign(patient, {
    data: {
      ...patient.data,
      externalData: {
        ...patient.data.externalData,
        [MedicalDataSource.COMMONWELL]: cwEntry as PatientDataCommonwell,
      },
    },
  });
  return patientWithCW;
}

function isInsideOrgExcludeList(link: NetworkLink, orgIdExcludeList: string[]): boolean {
  const identifiers = link.patient?.identifier || [];
  return identifiers.some(id => {
    const idSystem = id.system?.replace(urnOidRegex, "");
    if (idSystem && orgIdExcludeList.includes(idSystem)) {
      return true;
    }
    return false;
  });
}

/**
 * This function will automatically upgrade all of the LOLA 1 network links
 * for a given patient to LOLA 2.
 *
 * @param commonWell - The CommonWell API object
 * @param queryMeta - RequestMetadata - this is the metadata that is passed in from the client.
 *    It contains the user's session token, the user's organization, and the user's userId.
 * @param networkLinks - The network links to process
 * @param invalidLinks - The invalid network links to process
 * @param commonwellPatientId - The patient ID in the CommonWell system
 * @param commonwellPersonId - The CommonWell Person ID of the patient
 * @param executionContext - The execution context of the current request.
 * @param getOrgIdExcludeList - Function to get the list of organization IDs to exclude from
 *    network links
 */
export async function autoUpgradeNetworkLinks(
  commonWell: CommonWellAPI,
  queryMeta: RequestMetadata,
  networkLinks: CwLink[],
  invalidLinks: CwLink[],
  commonwellPatientId: string,
  commonwellPersonId: string,
  executionContext: string,
  getOrgIdExcludeList: () => Promise<string[]>
): Promise<void> {
  const { log, debug } = out("CW autoUpgradeNetworkLinks");

  const orgIdExcludeList = await getOrgIdExcludeList();
  debug(`resp getNetworkLinks: `, JSON.stringify(networkLinks));
  debug(`resp invalidLinks: `, JSON.stringify(invalidLinks));

  if (networkLinks.length) {
    const validLola1Links = networkLinks.flatMap(filterTruthy).filter(isLOLA1);
    const validLola2or3Links = networkLinks.flatMap(filterTruthy).filter(isLOLA2 || isLOLA3);
    const invalidLola2or3Links = invalidLinks.flatMap(filterTruthy).filter(isLOLA2 || isLOLA3);

    const validLola2or3LinksToDowngrade = validLola2or3Links.filter(link =>
      isInsideOrgExcludeList(link, orgIdExcludeList)
    );

    const lola2or3LinksToDowngrade = [...validLola2or3LinksToDowngrade, ...invalidLola2or3Links];

    const downgradeRequests: Promise<NetworkLink>[] = [];
    lola2or3LinksToDowngrade.forEach(async link => {
      if (link._links?.downgrade?.href) {
        downgradeRequests.push(
          commonWell
            .upgradeOrDowngradeNetworkLink(queryMeta, link._links.downgrade.href)
            .catch(error => {
              const msg = `Failed to downgrade link`;
              log(`${msg}. Cause: ${errorToString(error)}`);
              capture.error(msg, {
                extra: {
                  commonwellPatientId,
                  commonwellPersonId,
                  cwReference: commonWell.lastReferenceHeader,
                  context: executionContext,
                  error,
                },
              });
              throw error;
            })
        );
      } else {
        capture.message(`Missing downgrade link for network link`, {
          extra: {
            link: link,
            commonwellPatientId,
            commonwellPersonId,
            context: executionContext,
          },
          level: "warning",
        });
      }
    });

    await Promise.allSettled(downgradeRequests);

    const lola1LinksToUpgrade = validLola1Links.filter(
      link => !isInsideOrgExcludeList(link, orgIdExcludeList)
    );
    const upgradeRequests: Promise<NetworkLink>[] = [];
    lola1LinksToUpgrade.forEach(async link => {
      if (link._links?.upgrade?.href) {
        upgradeRequests.push(
          commonWell
            .upgradeOrDowngradeNetworkLink(queryMeta, link._links.upgrade.href)
            .catch(error => {
              const msg = `Failed to upgrade link`;
              log(`${msg}. Cause: ${errorToString(error)}`);
              capture.error(msg, {
                extra: {
                  commonwellPatientId,
                  commonwellPersonId,
                  cwReference: commonWell.lastReferenceHeader,
                  context: executionContext,
                  error,
                },
              });
              throw error;
            })
        );
      }
    });
    await Promise.allSettled(upgradeRequests);
  }
}

export async function getPatientsNetworkLinks(
  commonWell: CommonWellAPI,
  queryMeta: RequestMetadata,
  commonwellPatientId: string
): Promise<NetworkLink[]> {
  const { debug, log } = out("CW getPatientNetworkLinks");

  try {
    const networkLinks = await commonWell.getNetworkLinks(queryMeta, commonwellPatientId);

    debug(`resp getNetworkLinks: `, JSON.stringify(networkLinks));

    if (!networkLinks._embedded?.networkLink) {
      log(`No network links found for patient ${commonwellPatientId}`);
      return [];
    }

    const validNetworkLinks: NetworkLink[] = [];

    for (const networkLink of networkLinks._embedded.networkLink) {
      if (networkLink) {
        validNetworkLinks.push(networkLink);
      }
    }

    return validNetworkLinks;
  } catch (error) {
    log(`Error getting patient network links. Cause: ${errorToString(error)}`);
    throw error;
  }
}

export function cwLinkToPatientData(cwLink: NetworkLink): PatientData {
  const patient = cwLink.patient;

  const firstName = patient?.details.name.flatMap(name => name.given).join(" ") ?? "";
  const lastName = patient?.details.name.flatMap(name => name.family).join(" ") ?? "";
  const dob = patient?.details.birthDate
    ? buildDayjs(patient.details.birthDate).format(ISO_DATE)
    : "";
  const genderCode = patient?.details.gender.code;
  const genderAtBirth = genderCode === "M" ? "M" : genderCode === "F" ? "F" : "U";

  const address = patient?.details.address
    ? patient?.details.address.map(address => ({
        zip: address.zip,
        city: address.city ?? "",
        state: address.state as USStateForAddress,
        country: address.country ?? "",
        addressLine1: address.line?.[0] ?? "",
        addressLine2: address.line?.[1] ?? "",
      }))
    : [];

  const phone = patient?.details.telecom?.find(telecom => telecom.system === "phone")?.value ?? "";

  const email = patient?.details.telecom?.find(telecom => telecom.system === "email")?.value ?? "";

  return {
    firstName,
    lastName,
    dob,
    genderAtBirth,
    address,
    contact: [
      {
        phone,
        email,
      },
    ],
  };
}

export function cwGenderToPatientGender(gender: string | undefined): GenderAtBirth {
  if (gender === "M") return "M";
  if (gender === "F") return "F";
  return "U";
}
