import {
  CommonWellAPI,
  isLOLA1,
  NetworkLink,
  Person,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { MedicalDataSource } from "../..";
import {
  Patient,
  PatientData,
  PatientExternalData,
  PatientExternalDataEntry,
} from "../../../domain/medical/patient";
import { filterTruthy } from "../../../shared/filter-map-utils";
import { capture } from "@metriport/core/util/notifications";
import { PatientDataCommonwell } from "../patient-shared";

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

    const requests: Promise<NetworkLink>[] = [];

    lola1Links.forEach(async link => {
      if (link._links?.upgrade?.href) {
        requests.push(
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
    await Promise.allSettled(requests);
  }
}
