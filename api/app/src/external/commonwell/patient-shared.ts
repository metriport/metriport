import {
  CommonWell,
  getId,
  Patient as CommonwellPatient,
  Person as CommonwellPerson,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { getPatientWithDependencies } from "../../command/medical/patient/get-patient";
import { Facility } from "../../models/medical/facility";
import { Organization } from "../../models/medical/organization";
import { Patient, PatientExternalDataEntry } from "../../models/medical/patient";
import { filterTruthy } from "../../shared/filter-map-utils";
import { Util } from "../../shared/util";
import { makePersonForPatient } from "./patient-conversion";

export class PatientDataCommonwell extends PatientExternalDataEntry {
  constructor(public patientId: string, public personId?: string | undefined) {
    super();
  }
}

type SimpleStrongId = { key: string; system: string };

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
}): Promise<string | undefined> {
  const { log, debug } = Util.out(`CW findOrCreatePerson - CW patientId ${commonwellPatientId}`);
  const person = makePersonForPatient(commonwellPatient);
  const strongIds = getPersonalIdentifiers(person);
  if (strongIds.length > 0) {
    // Search by personal ID
    const personIds = await searchPersonIds({ commonWell, queryMeta, strongIds });
    if (personIds.length === 1) return personIds[0];
    if (personIds.length > 1) {
      // TODO #156 SENTRY
      // TODO #369 SLACK
      log(`Found more than one person with the Strong IDs: ${JSON.stringify(strongIds)}`);
      // TODO #369 could get the first one that matches all demographics and use it while OPs review it?
      return undefined;
    }
  } else {
    // Search by demographics
    await commonWell.searchPersonByPatientDemo(queryMeta, commonwellPatientId);
    // TODO #369 Implement
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
  return personId;
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

async function searchPersonIds({
  commonWell,
  queryMeta,
  strongIds,
}: {
  commonWell: CommonWell;
  queryMeta: RequestMetadata;
  strongIds: SimpleStrongId[];
}): Promise<string[]> {
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
  const duplicatedPersonIds = fulfilled.flatMap(f => getId(f)).flatMap(filterTruthy);
  return Array.from(new Set(duplicatedPersonIds));
}

function getPersonalIdentifiers(person: CommonwellPatient | CommonwellPerson): SimpleStrongId[] {
  return (person.details?.identifier ?? []).flatMap(id =>
    id.key !== undefined && id.system !== undefined ? { key: id.key, system: id.system } : []
  );
}
