import {
  CommonWellAPI,
  isLOLA1,
  isLOLA2,
  isLOLA3,
  NetworkLink,
  Person,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { errorToString } from "@metriport/core/util/error/shared";
import {
  Patient,
  PatientData,
  PatientExternalData,
  PatientExternalDataEntry,
} from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
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
 * @param commonwellPatientId - The patient ID in the CommonWell system
 * @param commonwellPersonId - The CommonWell Person ID of the patient
 * @param executionContext - The execution context of the current request.
 * @param getOrgIdExcludeList - Function to get the list of organization IDs to exclude from
 *    network links
 */
export async function autoUpgradeNetworkLinks(
  commonWell: CommonWellAPI,
  queryMeta: RequestMetadata,
  commonwellPatientId: string,
  commonwellPersonId: string,
  executionContext: string,
  getOrgIdExcludeList: () => Promise<string[]>
) {
  const { log } = out("cw.autoUpgradeNetworkLinks");
  const [networkLinks, orgIdExcludeList] = await Promise.all([
    commonWell.getNetworkLinks(queryMeta, commonwellPatientId),
    getOrgIdExcludeList(),
  ]);

  if (networkLinks._embedded && networkLinks._embedded.networkLink?.length) {
    const lola1Links = networkLinks._embedded.networkLink.flatMap(filterTruthy).filter(isLOLA1);
    const lola2or3Links = networkLinks._embedded.networkLink
      .flatMap(filterTruthy)
      .filter(isLOLA2 || isLOLA3);

    const lola2or3LinksToDowngrade = lola2or3Links.filter(link =>
      isInsideOrgExcludeList(link, orgIdExcludeList)
    );
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

    const lola1LinksToUpgrade = lola1Links.filter(
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
