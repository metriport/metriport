import {
  CommonWellAPI,
  Patient as CommonwellPatient,
  Person as CommonwellPerson,
  RequestMetadata,
  StrongId,
} from "@metriport/commonwell-sdk";
import { driversLicenseURIs } from "@metriport/core/domain/oid";
import { Patient, PatientExternalDataEntry } from "@metriport/core/domain/patient";
import { intersectionBy } from "lodash";
import { filterTruthy } from "../../shared/filter-map-utils";
import { capture } from "../../shared/notifications";
import { LinkStatus } from "../patient-link";
import { CQLinkStatus } from "./patient-external-data";

export class PatientDataCommonwell extends PatientExternalDataEntry {
  constructor(
    public patientId: string,
    public personId?: string,
    public cqLinkStatus?: CQLinkStatus,
    /**
     * The start of the patient discovery.
     */
    public pdStartedAt?: Date,
    /**
     * The facility ID used for the patient discovery.
     */
    public pdFacilityId?: string,
    /**
     * The request Id the patient discovery.
     */
    public pdRequestId?: string,
    /**
     * The status of the patient discovery.
     */
    public status?: LinkStatus,
    /**
     * The request ID for the next patient discovery while the current patient discovery was processing.
     */

    public scheduledPdRequestId?: string,
    /**
     * The request ID for the document query triggered while the patient discovery was processing.
     */
    public scheduledDocQueryRequestId?: string
  ) {
    super();
  }
}

type SimplifiedPersonalId = { key: string; system: string };

export function getMatchingStrongIds(
  person: CommonwellPerson,
  patient: CommonwellPatient
): StrongId[] {
  const personIds = person.details?.identifier;
  const patientIds = patient.details?.identifier;
  if (!personIds || !personIds.length || !patientIds || !patientIds.length) return [];
  return intersectionBy(personIds, patientIds, id => `${id.system}|${id.key}`);
}

export async function searchPersons({
  commonWell,
  queryMeta,
  strongIds,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  strongIds: SimplifiedPersonalId[];
}): Promise<CommonwellPerson[]> {
  const respSearches = await Promise.allSettled(
    strongIds.map(id =>
      commonWell.searchPerson(queryMeta, id.key, id.system).catch(error => {
        const msg = `Failed to search for person with strongId`;
        console.log(`${msg}. Cause: ${error}`);
        capture.message(msg, { extra: { context: `cw.searchPersons`, error }, level: "error" });
        throw error;
      })
    )
  );
  const fulfilled = respSearches
    .flatMap(r => (r.status === "fulfilled" ? r.value._embedded?.person : []))
    .flatMap(filterTruthy);

  return fulfilled;
}

export function getPersonalIdentifiersFromPatient(patient: Patient): SimplifiedPersonalId[] {
  return (patient.data.personalIdentifiers ?? []).flatMap(id =>
    id.value !== undefined && id.state !== undefined
      ? { key: id.value, system: driversLicenseURIs[id.state] }
      : []
  );
}
