import {
  CommonWellAPI,
  getDemographics,
  getPersonId,
  isEnrolled,
  isUnenrolled,
  Patient as CommonwellPatient,
  Person as CommonwellPerson,
  RequestMetadata,
  StrongId,
} from "@metriport/commonwell-sdk";
import { PatientExternalDataEntry } from "@metriport/core/domain/patient";
import { intersectionBy, minBy } from "lodash";
import { filterTruthy } from "../../shared/filter-map-utils";
import { capture } from "../../shared/notifications";
import { Util } from "../../shared/util";
import { LinkStatus } from "../patient-link";
import { makePersonForPatient } from "./patient-conversion";

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

export type FindOrCreatePersonResponse = { personId: string; person: CommonwellPerson } | undefined;

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
  const context = `cw.findOrCreatePerson.strongIds`;
  const person = makePersonForPatient(commonwellPatient);
  const strongIds: StrongId[] = person.details?.identifier ?? [];
  if (strongIds.length > 0) {
    // Search by personal ID
    // TODO: we should be returning instances of CommonwellPerson here, so we return what we get from CW on this function, not
    // the result of calling `makePersonForPatient()`
    const personIds = await searchPersonIds({ commonWell, queryMeta, strongIds });
    if (personIds.length === 1) return { personId: personIds[0] as string, person };
    if (personIds.length > 1) {
      const subject = "Found more than one person for patient personal IDs";
      const message = idsToAlertMessage(commonwellPatientId, personIds);
      log(`${subject}: ${message}`);
      capture.message(subject, {
        extra: { commonwellPatientId, personIds, context },
      });
      // TODO consider also returning the most recent person here
      return undefined;
    }
  } else {
    // Search by demographics
    const respSearch = await commonWell.searchPersonByPatientDemo(queryMeta, commonwellPatientId);
    debug(`resp searchPersonByPatientDemo: `, JSON.stringify(respSearch));
    const persons = respSearch._embedded?.person
      ? respSearch._embedded.person
          .flatMap(p => (p && getPersonId(p) ? p : []))
          .flatMap(filterTruthy)
      : [];

    const enrolledPersons = persons.filter(isEnrolled);
    if (enrolledPersons.length === 1) {
      const result = buildReturn(enrolledPersons[0]);
      if (result) return result;
    }

    if (enrolledPersons.length > 1) {
      // TODO needs to be rewritten to return the one with most links
      // Update 2023-12-12: the above TODO may be deprecated, since we actually want to link to the earliest person - even if the one has more links, they could be a "duplicate" patient that'll be removed later
      return alertAndReturnEarliestPerson(
        commonwellPatientId,
        [enrolledPersons[0] as CommonwellPerson, ...enrolledPersons.slice(1)], // to match the type requiring at least one element
        commonWell.lastReferenceHeader,
        context
      );
    }

    const unenrolledPersons = persons.filter(isUnenrolled);
    if (unenrolledPersons.length === 1) {
      const result = buildReturn(unenrolledPersons[0]);
      if (result) {
        await commonWell.reenrollPerson(queryMeta, result.personId);
        return result;
      }
    }
    if (unenrolledPersons.length > 1) {
      const result = alertAndReturnEarliestPerson(
        commonwellPatientId,
        [unenrolledPersons[0] as CommonwellPerson, ...unenrolledPersons.slice(1)], // to match the type requiring at least one element
        commonWell.lastReferenceHeader,
        context
      );
      if (result) {
        await commonWell.reenrollPerson(queryMeta, result.personId);
        return result;
      }
    }

    // if didn't find any, proceed to add/enroll
  }

  // If not found, enroll/add person
  debug(`Enrolling this person: `, JSON.stringify(person));
  const respPerson = await commonWell.enrollPerson(queryMeta, person);
  debug(`resp enrollPerson: `, JSON.stringify(respPerson));
  const personId = getPersonId(respPerson);
  if (!personId) {
    const msg = `Could not get person ID from CW response`;
    log(`${msg} - CW response: ${JSON.stringify(respPerson)}`);
    throw new Error(msg);
  }
  return { personId, person };
}

function buildReturn(cwPerson?: CommonwellPerson): FindOrCreatePersonResponse | undefined {
  const personId = getPersonId(cwPerson);
  if (cwPerson && personId) return { personId, person: cwPerson };
  return undefined;
}

function alertAndReturnEarliestPerson(
  commonwellPatientId: string,
  persons: [CommonwellPerson, ...CommonwellPerson[]],
  cwReference?: string,
  context?: string
): FindOrCreatePersonResponse {
  const { log } = Util.out(
    `CW alertAndReturnMostRecentPerson - CW patientId ${commonwellPatientId}`
  );
  const personIds = persons.map(getPersonId).flatMap(filterTruthy);
  const subject = "Found more than one person for patient demographics";
  const message = idsToAlertMessage(commonwellPatientId, personIds);
  log(`${subject} - using the earliest one: ${message}`);
  capture.message(subject, {
    extra: {
      action: `Using the earliest one`,
      commonwellPatientId,
      persons: getDemographics(persons),
      cwReference,
      context,
    },
  });
  const person = getEarliestPerson(persons);
  const personId = getPersonId(person);
  if (person && personId) return { personId, person };
  return undefined;
}

function getEarliestPerson(persons: [CommonwellPerson, ...CommonwellPerson[]]): CommonwellPerson {
  const earlierst = minBy(persons, p => p.enrollmentSummary?.dateEnrolled);
  const firstOne = persons[0];
  return (earlierst ?? firstOne) as CommonwellPerson;
}

function idsToAlertMessage(cwPatientId: string, personIds: string[]): string {
  return `Patient CW ID: ${cwPatientId}; Person IDs: ${personIds.join(", ")}`;
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
  strongIds,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  strongIds: StrongId[];
}): Promise<string[]> {
  const { log } = Util.out(`CW searchPersonIds`);
  const respSearches = await Promise.allSettled(
    strongIds.map(id =>
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

export async function searchPersons({
  commonWell,
  queryMeta,
  strongIds,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  strongIds: StrongId[];
}): Promise<CommonwellPerson[]> {
  const { log } = Util.out(`CW searchPersons`);
  const respSearches = await Promise.allSettled(
    strongIds.map(id =>
      commonWell.searchPerson(queryMeta, id.key, id.system).catch(error => {
        const msg = `Failed to search for person with strongId`;
        log(`${msg}. Cause: ${error}`);
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
