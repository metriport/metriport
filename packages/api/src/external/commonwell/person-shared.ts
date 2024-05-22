import {
  CommonWellAPI,
  getPersonId,
  Person,
  RequestMetadata,
  StrongId,
  getDemographics,
} from "@metriport/commonwell-sdk";
import { errorToString } from "@metriport/shared/common/error";
import { capture } from "@metriport/core/util/notifications";
import { out } from "@metriport/core/util/log";
import { minBy } from "lodash";

export type PersonWithId = Person & { personId: string };
export type singlePersonWithId = [PersonWithId, ...PersonWithId[]];
export type multiplePersonWithId = [PersonWithId, PersonWithId, ...PersonWithId[]];

export function isEnrolledBy(orgName: string, person: Person): boolean {
  return person?.enrollmentSummary?.enroller === orgName;
}

export async function matchPersonsByDemo({
  commonWell,
  queryMeta,
  commonWellPatientId,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonWellPatientId: string;
}): Promise<PersonWithId[]> {
  const { debug } = out(`CW matchPersonsByDemo - CW patientId ${commonWellPatientId}`);

  const respSearch = await commonWell.searchPersonByPatientDemo(queryMeta, commonWellPatientId);
  debug(`resp searchPersonByPatientDemo: `, JSON.stringify(respSearch));

  const persons = respSearch._embedded.person;
  const personsValidId = persons.filter(getPersonId).map(p => {
    return { personId: getPersonId(p) as string, ...p };
  });
  return personsValidId;
}

export async function matchPersonsByStrongIds({
  commonWell,
  queryMeta,
  commonWellPatientId,
  strongIds,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonWellPatientId: string;
  strongIds: StrongId[];
}): Promise<PersonWithId[]> {
  const { debug } = out(`CW matchPersonsByStrongIds - CW patientId ${commonWellPatientId}`);

  const respSearches = await Promise.allSettled(
    strongIds.map(id =>
      commonWell.searchPerson(queryMeta, id.key, id.system).catch(error => {
        const msg = "searchPersonsWithValidPersonId - Failed to search for person with strongId";
        console.error(
          `${msg}. strongIds: ${JSON.stringify(strongIds)}. Cause: ${errorToString(error)}`
        );
        capture.error(msg, {
          extra: {
            error,
            context: `cw.searchPersonsWithValidPersonId`,
          },
        });
        throw error;
      })
    )
  );
  debug(`resp searchPerson (allSettled): `, JSON.stringify(respSearches));

  const persons = respSearches.flatMap(r =>
    r.status === "fulfilled" ? r.value._embedded.person : []
  );
  const personsValidId = persons.filter(getPersonId).map(p => {
    return { personId: getPersonId(p) as string, ...p };
  });
  const personsValidIdUnique = [...new Map(personsValidId.map(p => [p.personId, p])).values()];
  return personsValidIdUnique;
}

export function handleMultiplePersonMatches({
  commonWellPatientId,
  persons,
  context,
  cwReference,
}: {
  commonWellPatientId: string;
  persons: multiplePersonWithId;
  context: string;
  cwReference?: string;
}): { personId: string; person: PersonWithId } {
  const { log } = out(`CW handleMultiplePersonMatches - CW patientId ${commonWellPatientId}`);

  const personIds = persons.map(p => p.personId);
  const msg = "Found more than one person.";
  log(`${msg}. Context: ${context}. Earliest Person ID from: ${personIds.join(", ")}`);
  capture.message(msg, {
    extra: {
      action: "Earliest",
      commonWellPatientId,
      persons: getDemographics(persons),
      context,
      cwReference,
    },
    level: "info",
  });
  // TODO Explore whether to change to person with most links
  const person = getEarliestPerson(persons);
  return { personId: person.personId, person };
}

function getEarliestPerson(persons: multiplePersonWithId): PersonWithId {
  const earlierst = minBy(persons, p => p.enrollmentSummary?.dateEnrolled);
  const firstOne = persons[0];
  return earlierst ?? firstOne;
}
