import {
  CommonWell,
  getId,
  Patient as CommonwellPatient,
  Person as CommonwellPerson,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { StrongId } from "@metriport/commonwell-sdk/lib/models/identifier";
import _ from "lodash";
import { getPatientWithDependencies } from "../../command/medical/patient/get-patient";
import { Facility } from "../../models/medical/facility";
import { Organization } from "../../models/medical/organization";
import { Patient, PatientExternalDataEntry } from "../../models/medical/patient";
import { filterTruthy } from "../../shared/filter-map-utils";
import { sendAlert } from "../../shared/notifications";
import { Util } from "../../shared/util";
import { makePersonForPatient } from "./patient-conversion";

export class PatientDataCommonwell extends PatientExternalDataEntry {
  constructor(public patientId: string, public personId?: string | undefined) {
    super();
  }
}

type SimplifiedPersonalId = { key: string; system: string };

export async function findOrCreatePerson({
  commonWell,
  queryMeta,
  commonwellPatient,
  commonwellPatientId,
}: {
  commonWell: CommonWell;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
}): Promise<{ personId: string; person: CommonwellPerson } | undefined> {
  const { log, debug } = Util.out(`CW findOrCreatePerson - CW patientId ${commonwellPatientId}`);
  const person = makePersonForPatient(commonwellPatient);
  const strongIds = getPersonalIdentifiers(person);
  if (strongIds.length > 0) {
    // Search by personal ID
    const personIds = await searchPersonIds({ commonWell, queryMeta, personalIds: strongIds });
    if (personIds.length === 1) return { personId: personIds[0], person };
    if (personIds.length > 1) {
      const subject = "Found more than one person for patient personal IDs";
      const message =
        `Patient CW ID: ${commonwellPatientId}\n` +
        `Personal IDs: ${strongIds.map(id => id.key).join(", ")}` +
        `Person CW IDs: ${personIds.join(", ")}`;
      sendAlert({ subject, message });
      // TODO #156 SENTRY
      log(`${subject}: ${message}`);
      return undefined;
    }
  } else {
    // Search by demographics
    const respSearch = await commonWell.searchPersonByPatientDemo(queryMeta, commonwellPatientId);
    debug(`resp searchPersonByPatientDemo: `, respSearch);
    const personIds = respSearch._embedded?.person
      ? respSearch._embedded.person.map(getId).flatMap(filterTruthy)
      : [];
    if (personIds.length === 1) return { personId: personIds[0], person };
    if (personIds.length > 1) {
      const subject = "Found more than one person for patient demographics";
      const message = `Patient CW ID: ${commonwellPatientId}\nPerson CW IDs: ${personIds.join(
        ", "
      )}`;
      log(`${subject}: ${message}`);
      return undefined;
    }
    return;
  }

  // If not found, enroll/add person
  debug(`Enrolling this person: ${JSON.stringify(person, null, 2)}`);
  const respPerson = await commonWell.enrollPerson(queryMeta, person);
  debug(`resp enrollPerson: `, respPerson);
  const personId = getId(respPerson);
  if (!personId) {
    const msg = `Could not get person ID from CW response`;
    log(`${msg} - CW response: ${JSON.stringify(respPerson)}`);
    throw new Error(msg);
  }
  return { personId, person };
}

export async function getPatientData(
  patient: Patient,
  facilityId: string
): Promise<{
  organization: Organization;
  facility: Facility;
}> {
  const { organization, facilities } = await getPatientWithDependencies(patient);
  const facility = facilities.find(f => f.id === facilityId);
  if (!facility) {
    throw new Error(`Could not find facility ${facilityId} with patient ${patient.id}`);
  }
  return { organization, facility };
}

export function getMatchingStrongIds(
  person: CommonwellPerson,
  commonwellPatient: CommonwellPatient
): StrongId[] {
  const personIds = person.details?.identifier;
  const patientIds = commonwellPatient.details?.identifier;
  if (!personIds || !personIds.length || !patientIds || !patientIds.length) return [];
  return _.intersectionBy(personIds, patientIds, id => `${id.system}|${id.key}`);
}

async function searchPersonIds({
  commonWell,
  queryMeta,
  personalIds,
}: {
  commonWell: CommonWell;
  queryMeta: RequestMetadata;
  personalIds: SimplifiedPersonalId[];
}): Promise<string[]> {
  const respSearches = await Promise.allSettled(
    personalIds.map(id => commonWell.searchPerson(queryMeta, id.key, id.system))
  );
  const rejectedReasons = respSearches.flatMap(r => (r.status === "rejected" ? r.reason : []));
  if (rejectedReasons.length > 0) {
    // TODO #156 SENTRY
    const subject = `Failure searching person @ CW by personal ID`;
    const message =
      `Personal IDs: ${personalIds.map(id => id.key).join(", ")}\n` +
      `Failures (${rejectedReasons.length}):\n- ${rejectedReasons.join("\n- ")}`;
    sendAlert({ subject, message });
    console.log(`${subject}: ${message}`);
  }
  const fulfilledPersons = respSearches
    .flatMap(r => (r.status === "fulfilled" ? r.value._embedded?.person : []))
    .flatMap(filterTruthy);
  const duplicatedPersonIds = fulfilledPersons.flatMap(getId).flatMap(filterTruthy);
  return Array.from(new Set(duplicatedPersonIds));
}

function getPersonalIdentifiers(
  person: CommonwellPatient | CommonwellPerson
): SimplifiedPersonalId[] {
  return (person.details?.identifier ?? []).flatMap(id =>
    id.key !== undefined && id.system !== undefined ? { key: id.key, system: id.system } : []
  );
}
