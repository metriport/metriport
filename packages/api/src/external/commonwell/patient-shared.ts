import {
  CommonWellAPI,
  getPersonId,
  isEnrolled,
  isUnenrolled,
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
import { Util } from "../../shared/util";
import { LinkStatus } from "../patient-link";
import { makePersonForPatient } from "./patient-conversion";
import {
  matchPersonsByDemo,
  matchPersonsByStrongIds,
  handleMultiplePersonMatches,
  singlePersonWithId as singleCommonwellPersonWithId,
  multiplePersonWithId as multipleCommonwellPersonWithId,
} from "./person-shared";

export const cqLinkStatus = ["unlinked", "processing", "linked"] as const;
/**
 * Status of the patient's link to CareQuality.
 */
export type CQLinkStatus = (typeof cqLinkStatus)[number];

export class PatientDataCommonwell extends PatientExternalDataEntry {
  constructor(
    public patientId: string,
    public personId?: string | undefined,
    public status?: LinkStatus | undefined,
    public cqLinkStatus?: CQLinkStatus,
    public scheduledDocQueryRequestId?: string | undefined
  ) {
    super();
  }
}

type SimplifiedPersonalId = { key: string; system: string };

export type FindOrCreatePersonResponse = { personId: string; person: CommonwellPerson };

export async function findOrCreatePerson({
  commonWell,
  queryMeta,
  commonwellPatient,
  commonwellPatientId,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
}): Promise<FindOrCreatePersonResponse> {
  const { log, debug } = Util.out(`CW findOrCreatePerson - CW patientId ${commonwellPatientId}`);
  const baseContext = `cw.findOrCreatePerson`;

  const tempCommonwellPerson = makePersonForPatient(commonwellPatient);
  const strongIds = getPersonalIdentifiers(tempCommonwellPerson);
  if (strongIds.length > 0) {
    const persons = await matchPersonsByStrongIds({
      commonWell,
      queryMeta,
      strongIds,
      commonwellPatientId,
    });
    if (persons.length === 1) {
      const person = (persons as singleCommonwellPersonWithId)[0]; // There's gotta be a better way
      return { personId: person.personId, person };
    }
    if (persons.length > 1) {
      return handleMultiplePersonMatches({
        commonwellPatientId,
        persons: persons as multipleCommonwellPersonWithId, // There's gotta be a better way
        context: baseContext + ".strongIds",
      });
    }
  }
  const persons = await matchPersonsByDemo({
    commonWell,
    queryMeta,
    commonwellPatientId,
  });
  const enrolledPersons = persons.filter(isEnrolled);
  if (enrolledPersons.length === 1) {
    const person = (enrolledPersons as singleCommonwellPersonWithId)[0]; // There's gotta be a better way
    return { personId: person.personId, person };
  }
  if (enrolledPersons.length > 1) {
    // TODO needs to be rewritten to return the one with most links
    // Update 2023-12-12: the above TODO may be deprecated, since we actually want to link to the earliest person - even if the one has more links, they could be a "duplicate" patient that'll be removed later
    return handleMultiplePersonMatches({
      commonwellPatientId,
      persons: enrolledPersons as multipleCommonwellPersonWithId, // There's gotta be a better way
      context: baseContext + ".enrolled.demographics",
    });
  }
  const unenrolledPersons = persons.filter(isUnenrolled);
  if (unenrolledPersons.length === 1) {
    const person = (unenrolledPersons as singleCommonwellPersonWithId)[0]; // There's gotta be a better way
    await commonWell.reenrollPerson(queryMeta, person.personId);
    return { personId: person.personId, person };
  }
  if (unenrolledPersons.length > 1) {
    const { personId, person } = handleMultiplePersonMatches({
      commonwellPatientId,
      persons: unenrolledPersons as multipleCommonwellPersonWithId, // There's gotta be a better way
      context: baseContext + ".unenrolled.demographics",
    });
    await commonWell.reenrollPerson(queryMeta, personId);
    return { personId, person };
  }

  // If not found, enroll/add person
  debug(`Enrolling this person: `, JSON.stringify(tempCommonwellPerson));
  const respPerson = await commonWell.enrollPerson(queryMeta, tempCommonwellPerson);
  debug(`resp enrollPerson: `, JSON.stringify(respPerson));
  const personId = getPersonId(respPerson);
  if (!personId) {
    const msg = `Could not get person ID from CW response`;
    log(`${msg} - CW response: ${JSON.stringify(respPerson)}`);
    throw new Error(msg);
  }
  return { personId, person: respPerson };
}

export function getMatchingStrongIds(
  person: CommonwellPerson,
  commonwellPatient: CommonwellPatient
): StrongId[] {
  const personIds = person.details?.identifier;
  const patientIds = commonwellPatient.details?.identifier;
  if (!personIds || !personIds.length || !patientIds || !patientIds.length) return [];
  return intersectionBy(personIds, patientIds, id => `${id.system}|${id.key}`);
}

export async function searchPersonIds({
  commonWell,
  queryMeta,
  personalIds,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  personalIds: SimplifiedPersonalId[];
}): Promise<string[]> {
  const { log } = Util.out(`CW searchPersonIds`);
  const respSearches = await Promise.allSettled(
    personalIds.map(id =>
      commonWell.searchPerson(queryMeta, id.key, id.system).catch(error => {
        const msg = `Failure searching person @ CW by personal ID`;
        log(`${msg}. Cause: ${error}`);
        capture.message(msg, { extra: { context: `cw.searchPersonIds`, error }, level: "error" });
        throw error;
      })
    )
  );
  const fulfilledPersons = respSearches
    .flatMap(r => (r.status === "fulfilled" ? r.value._embedded?.person : []))
    .flatMap(filterTruthy);
  const duplicatedPersonIds = fulfilledPersons.flatMap(getPersonId).flatMap(filterTruthy);
  return Array.from(new Set(duplicatedPersonIds));
}

export function getPersonalIdentifiers(
  person: CommonwellPatient | CommonwellPerson
): SimplifiedPersonalId[] {
  return (person.details?.identifier ?? []).flatMap(id =>
    id.key !== undefined && id.system !== undefined ? { key: id.key, system: id.system } : []
  );
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
