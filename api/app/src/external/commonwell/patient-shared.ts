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
import { driversLicenseURIs } from "../../shared/oid";
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
      const message = idsToAlertMessage(commonwellPatientId, personIds);
      sendAlert({ subject, message });
      // TODO #156 SENTRY
      log(`${subject}: ${message}`);
      return undefined;
    }
  } else {
    // Search by demographics
    const respSearch = await commonWell.searchPersonByPatientDemo(queryMeta, commonwellPatientId);
    debug(`resp searchPersonByPatientDemo: ${JSON.stringify(respSearch, null, 2)}`);
    const personIds = respSearch._embedded?.person
      ? respSearch._embedded.person.map(getId).flatMap(filterTruthy)
      : [];
    if (personIds.length === 1) return { personId: personIds[0], person };
    if (personIds.length > 1) {
      const subject = "Found more than one person for patient demographics";
      const message = idsToAlertMessage(commonwellPatientId, personIds);
      log(`${subject}: ${message}`);
      return undefined;
    }
  }

  // If not found, enroll/add person
  debug(`Enrolling this person: ${JSON.stringify(person, null, 2)}`);
  const respPerson = await commonWell.enrollPerson(queryMeta, person);
  debug(`resp enrollPerson: ${JSON.stringify(respPerson, null, 2)}`);
  const personId = getId(respPerson);
  if (!personId) {
    const msg = `Could not get person ID from CW response`;
    log(`${msg} - CW response: ${JSON.stringify(respPerson)}`);
    throw new Error(msg);
  }
  return { personId, person };
}

function idsToAlertMessage(cwPatientId: string, personIds: string[]): string {
  return `Patient CW ID: ${cwPatientId}\nPerson IDs:\n- ${personIds.join("\n- ")}`;
}

export async function getPatientData(
  patient: {
    id: string;
    cxId: string;
  },
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

export async function searchPersonIds({
  commonWell,
  queryMeta,
  personalIds,
}: {
  commonWell: CommonWell;
  queryMeta: RequestMetadata;
  personalIds: SimplifiedPersonalId[];
}): Promise<string[]> {
  const { log } = Util.out(`CW searchPersonIds`);
  const respSearches = await Promise.allSettled(
    personalIds.map(id =>
      commonWell.searchPerson(queryMeta, id.key, id.system).catch(err => {
        // TODO #156 SENTRY
        log(`Failure searching person @ CW by personal ID`, err);
        throw err;
      })
    )
  );
  const fulfilledPersons = respSearches
    .flatMap(r => (r.status === "fulfilled" ? r.value._embedded?.person : []))
    .flatMap(filterTruthy);
  const duplicatedPersonIds = fulfilledPersons.flatMap(getId).flatMap(filterTruthy);
  return Array.from(new Set(duplicatedPersonIds));
}

export function getPersonalIdentifiers(
  person: CommonwellPatient | CommonwellPerson
): SimplifiedPersonalId[] {
  return (person.details?.identifier ?? []).flatMap(id =>
    id.key !== undefined && id.system !== undefined ? { key: id.key, system: id.system } : []
  );
}

// TODO: REFACTOR WITH ABOVE
export async function searchPersons({
  commonWell,
  queryMeta,
  strongIds,
}: {
  commonWell: CommonWell;
  queryMeta: RequestMetadata;
  strongIds: SimplifiedPersonalId[];
}): Promise<CommonwellPerson[]> {
  const respSearches = await Promise.allSettled(
    strongIds.map(id => commonWell.searchPerson(queryMeta, id.key, id.system))
  );
  const rejected = respSearches.flatMap(r => (r.status === "rejected" ? r.reason : []));
  if (rejected.length > 0) {
    // TODO #369 also send ONE message to Slack?
    rejected.forEach(reason =>
      // TODO #156 SENTRY
      console.log(`Failed to search for person with strongId: ${reason}`)
    );
  }
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
