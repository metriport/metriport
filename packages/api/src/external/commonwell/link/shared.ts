import {
  CommonWellAPI,
  isLOLA1,
  isLOLA2,
  isLOLA3,
  NetworkLink,
  Person,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { MedicalDataSource } from "@metriport/core/external/index";
import {
  Patient,
  PatientData,
  PatientExternalData,
  PatientExternalDataEntry,
} from "@metriport/core/domain/patient";
import { filterTruthy } from "../../../shared/filter-map-utils";
import { capture } from "../../../shared/notifications";
import { PatientDataCommonwell } from "../patient-shared";
import { getCQDirectoryEntryById } from "../../carequality/command/cq-directory/cq-gateways";

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

async function shouldDowngradeLink(link: NetworkLink): Promise<boolean> {
  const identifiers = link.patient?.identifier || [];
  const checkPromises = identifiers.map(async id => {
    const idSystem = id.system?.replace(/^urn:oid:/, "");
    if (idSystem) {
      return (await getCQDirectoryEntryById(idSystem)) !== undefined;
    }
    return false;
  });
  const results = await Promise.all(checkPromises);
  return results.includes(true); // true if any of the checks are true
}

async function assessIfCWCQDuplicatesAndDowngrade(
  link: NetworkLink,
  commonWell: CommonWellAPI,
  queryMeta: RequestMetadata,
  commonwellPatientId: string,
  commonwellPersonId: string,
  executionContext: string
): Promise<NetworkLink | undefined> {
  const shouldDowngrade = await shouldDowngradeLink(link);
  if (shouldDowngrade && link._links?.downgrade?.href) {
    console.log(`Downgrading link ${JSON.stringify(link, null, 2)} for ${commonwellPatientId}`);
    return commonWell
      .upgradeOrDowngradeNetworkLink(queryMeta, link._links.downgrade.href)
      .catch(error => {
        const msg = `Failed to downgrade link`;
        console.log(`${msg}. Cause: ${error}`);
        capture.message(msg, {
          extra: {
            commonwellPatientId,
            commonwellPersonId,
            cwReference: commonWell.lastReferenceHeader,
            context: executionContext,
          },
          level: "error",
        });
        throw error;
      });
  }
  return undefined;
}

/**
 * This function will automatically upgrade all of the LOLA 1 network links
 * for a given patient to LOLA 2.
 *
 * @param commonWell - The CommonWell API object
 * @param queryMeta - RequestMetadata - this is the metadata that is passed in from
 * the client.  It contains the user's session token, the user's organization, and the user's userId.
 * @param commonwellPatientId - The patient ID in the CommonWell system
 * @param commonwellPersonId - The CommonWell Person ID of the patient
 * @param executionContext - The execution context of the current request.
 */
export async function autoUpgradeNetworkLinks(
  commonWell: CommonWellAPI,
  queryMeta: RequestMetadata,
  commonwellPatientId: string,
  commonwellPersonId: string,
  executionContext: string
) {
  const networkLinks = await commonWell.getNetworkLinks(queryMeta, commonwellPatientId);

  if (networkLinks._embedded && networkLinks._embedded.networkLink?.length) {
    const lola1Links = networkLinks._embedded.networkLink.flatMap(filterTruthy).filter(isLOLA1);
    const lola2or3Links = networkLinks._embedded.networkLink
      .flatMap(filterTruthy)
      .filter(isLOLA2 || isLOLA3);

    const downgradeRequests: Promise<NetworkLink | undefined>[] = lola2or3Links.map(link =>
      assessIfCWCQDuplicatesAndDowngrade(
        link,
        commonWell,
        queryMeta,
        commonwellPatientId,
        commonwellPersonId,
        executionContext
      )
    );
    await Promise.allSettled(downgradeRequests);

    const upgradeRequests: Promise<NetworkLink>[] = [];
    lola1Links.forEach(async link => {
      if (link._links?.upgrade?.href) {
        upgradeRequests.push(
          commonWell
            .upgradeOrDowngradeNetworkLink(queryMeta, link._links.upgrade.href)
            .catch(error => {
              const msg = `Failed to upgrade link`;
              console.log(`${msg}. Cause: ${error}`);
              capture.message(msg, {
                extra: {
                  commonwellPatientId,
                  commonwellPersonId,
                  cwReference: commonWell.lastReferenceHeader,
                  context: executionContext,
                },
                level: "error",
              });
              throw error;
            })
        );
      }
    });
    await Promise.allSettled(upgradeRequests);
  }
}
