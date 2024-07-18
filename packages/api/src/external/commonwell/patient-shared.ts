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
import { PatientExternalDataEntry } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { intersectionBy } from "lodash";
import { LinkStatus } from "../patient-link";
import { makePersonForPatient } from "./patient-conversion";
import {
  matchPersonsByDemo,
  matchPersonsByStrongIds,
  handleMultiplePersonMatches,
  singlePersonWithId as singleCommonwellPersonWithId,
  multiplePersonsWithId as multipleCommonwellPersonsWithId,
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
  const { log, debug } = out(`CW findOrCreatePerson - CW patientId ${commonwellPatientId}`);
  const baseContext = `cw.findOrCreatePerson`;

  const tempCommonwellPerson = makePersonForPatient(commonwellPatient);
  const strongIds = tempCommonwellPerson.details.identifier ?? [];
  if (strongIds.length > 0) {
    // Search by personal ID
    const persons = await matchPersonsByStrongIds({
      commonWell,
      queryMeta,
      strongIds,
      commonwellPatientId,
    });
    if (persons.length === 1) {
      const person = (persons as singleCommonwellPersonWithId)[0];
      return { personId: person.personId, person };
    }
    if (persons.length > 1) {
      return handleMultiplePersonMatches({
        commonwellPatientId,
        persons: persons as multipleCommonwellPersonsWithId,
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
    const person = (enrolledPersons as singleCommonwellPersonWithId)[0];
    return { personId: person.personId, person };
  }
  if (enrolledPersons.length > 1) {
    // TODO needs to be rewritten to return the one with most links
    // Update 2023-12-12: the above TODO may be deprecated, since we actually want to link to the earliest person - even if the one has more links, they could be a "duplicate" patient that'll be removed later
    return handleMultiplePersonMatches({
      commonwellPatientId,
      persons: enrolledPersons as multipleCommonwellPersonsWithId,
      context: baseContext + ".enrolled.demographics",
    });
  }
  const unenrolledPersons = persons.filter(isUnenrolled);
  if (unenrolledPersons.length === 1) {
    const person = (unenrolledPersons as singleCommonwellPersonWithId)[0];
    await commonWell.reenrollPerson(queryMeta, person.personId);
    return { personId: person.personId, person };
  }
  if (unenrolledPersons.length > 1) {
    const { personId, person } = handleMultiplePersonMatches({
      commonwellPatientId,
      persons: unenrolledPersons as multipleCommonwellPersonsWithId,
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
