import {
  CommonWellAPI,
  getPersonId,
  PatientLinkSearchResp,
  Person,
} from "@metriport/commonwell-sdk";
import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import stringify from "json-stringify-safe";
import { chunk, groupBy } from "lodash";
import { PatientModel } from "../../../models/medical/patient";
import { filterTruthy } from "../../../shared/filter-map-utils";
import { Util } from "../../../shared/util";
import { getCWAccessForPatient } from "./shared";

const MAX_QUERIES_IN_PARALLEL = 10;

const JITTER_DELAY_MAX_MS = 500; // in milliseconds
const JITTER_DELAY_MIN_PCT = 30; // 1-100% of max delay

const CHUNK_DELAY_MAX_MS = 500; // in milliseconds
const CHUNK_DELAY_MIN_PCT = 50; // 1-100% of max delay

const undetermined = "unknown";

/**
 * personId might be the actual personId or "falsy" to indicate that the personId is `null | undefined`
 */
export type DuplicatedPersonsOfPatient = {
  // each person ID and the number of links it has to patients
  [personId: string]: {
    amountOfLinks?: number | string;
    enrolled?: boolean | string;
    enroller?: string;
    enrollmentDate?: string;
    /**
     * Indicates whether this element is related to metriport (when more than one personId or when this
     * represents an error/failure)
     */
    isMetriport?: true;
    /**
     * If there's no duplicate but person IDs don't match, this represents the local person ID
     */
    mismatchLocalId?: {
      id: string;
      amountOfLinks?: number | string;
      enroller?: string;
      enrollmentDate?: string;
    };
  };
};
export type DuplicatedPersons = {
  [cxId: string]: {
    [patientId: string]: DuplicatedPersonsOfPatient | undefined;
  };
};

/**
 * Checks for duplicated persons in CommonWell.
 */
export async function findDuplicatedPersons(cxId?: string): Promise<DuplicatedPersons> {
  const { log } = out(`findDuplicatedPersons`);
  log(cxId ? `Querying patients of cxId ${cxId}...` : `Querying all patients...`);

  // TODO paginate this
  // Don't move this to a command as we shouldn't easily allow to search Patients for all cxs
  const patients = await PatientModel.findAll({
    where: {
      ...(cxId ? { cxId } : undefined),
    },
  });
  const patientsByCustomer = groupBy(patients, "cxId");

  const res: DuplicatedPersons = {};

  for (const [cxId, patients] of Object.entries(patientsByCustomer)) {
    log(`Found ${patients.length} patients for cxId ${cxId}`);
    const personByCx: Record<string, DuplicatedPersonsOfPatient | undefined> = {};

    // TODO move to executeAsynchronously() from core
    const chunks = chunk(patients, MAX_QUERIES_IN_PARALLEL);
    const n = chunks.length;
    for (const [i, chunk] of chunks.entries()) {
      log(`Running chunk ${i + 1}/${n}...`);

      await Promise.allSettled(
        chunk.map(async patient => {
          await jitterInsideChunk(); // add some randomness before each request
          personByCx[patient.id] = await findDuplicatedPersonsByPatient(patient, log);
        })
      );
      await sleepBetweenChunks();
    }

    res[cxId] = personByCx;
  }

  return res;
}

const failed = (reason: string, isMetriport?: true): DuplicatedPersonsOfPatient => ({
  [reason]: { isMetriport },
});

export async function findDuplicatedPersonsByPatient(
  patient: Patient,
  log: typeof console.log
): Promise<DuplicatedPersonsOfPatient | undefined> {
  const simpleErrorLog = (op: string) => (err: unknown) => {
    log(`[patient ${patient.id}] Failed/error to ${op}: ${err}`);
    return undefined;
  };
  let commonWell: CommonWellAPI | undefined;
  try {
    const cwAccess = await getCWAccessForPatient(patient);
    if (cwAccess.error != null) return failed(cwAccess.error, true);

    const { queryMeta, cwPatientId, cwPersonId: storedPersonId } = cwAccess;
    commonWell = cwAccess.commonWell;

    const respSearch = await commonWell.searchPersonByPatientDemo(queryMeta, cwPatientId);

    const persons = respSearch._embedded?.person
      ? respSearch._embedded.person.flatMap(p => (p && getPersonId(p) ? p : []))
      : [];
    const filteredPersons = persons.flatMap(filterTruthy);
    if (filteredPersons.length === 1) {
      const thePerson = filteredPersons[0];
      const foundPersonId = getPersonId(thePerson);
      if (foundPersonId === storedPersonId && storedPersonId != undefined) {
        log(`Good! No duplicates found for patient ${patient.id} AND person IDs match!`);
        return undefined;
      } else {
        log(
          `No duplicates found for patient ${patient.id}, but person IDs dont match or are falsy (stored: ${storedPersonId}, found: ${foundPersonId})`
        );
        const [foundPersonLinks, storedPerson, storedPersonLinks] = await Promise.all([
          foundPersonId
            ? commonWell
                .getPatientLinks(queryMeta, foundPersonId)
                .catch(simpleErrorLog(`getPatientLinks, person ${foundPersonId}`))
            : undefined,
          storedPersonId
            ? commonWell
                .getPersonById(queryMeta, storedPersonId)
                .catch(simpleErrorLog(`getPersonById, person ${storedPersonId}`))
            : undefined,
          storedPersonId
            ? commonWell
                .getPatientLinks(queryMeta, storedPersonId)
                .catch(simpleErrorLog(`getPatientLinks, person ${storedPersonId}`))
            : undefined,
        ]);
        return {
          [foundPersonId ?? "falsy"]: {
            ...getLinkInfo(thePerson, foundPersonLinks),
            mismatchLocalId: {
              id: storedPersonId ?? "falsy",
              ...getLinkInfo(storedPerson, storedPersonLinks),
            },
          },
        };
      }
    } else if (filteredPersons.length < 1) {
      log(`Ouch, no person found for patient ${patient.id} - we should look into this!`);
      return failed("no-person-found-at-cw");
    }
    log(`Found ${filteredPersons.length} persons for patient ${patient.id}`);

    const personIds = filteredPersons.map(getPersonId).flatMap(filterTruthy);
    if (personIds.length < 1) {
      log(`Got FALSY person IDs for patient ${patient.id} - we should look into this!`);
      return failed("falsy-person-id");
    }

    const res: DuplicatedPersonsOfPatient = {};

    // for each person, get their enrolment details
    for (const person of filteredPersons) {
      const personId = getPersonId(person);
      if (!personId) {
        log(`Got a person without ID for patient ${patient.id}, skipping - ${stringify(person)}`);
        continue;
      }
      const patientLinks = await commonWell
        .getPatientLinks(queryMeta, personId)
        .catch(simpleErrorLog(`getPatientLinks, person ${personId}`));
      res[personId] = {
        ...getLinkInfo(person, patientLinks),
        ...(storedPersonId === personId ? { isMetriport: true } : {}),
      };
    }
    return res;
  } catch (error) {
    const msg = "Error while checking duplicates for patient";
    log(`${msg} ${patient.id} - error: ${error}`);
    capture.error(msg, {
      extra: {
        context: `findDuplicatedPersonsByPatient`,
        patient,
        cwReference: commonWell?.lastReferenceHeader,
        error,
      },
    });
    return undefined;
  }
}

const getLinkInfo = (person?: Person, links?: PatientLinkSearchResp) => ({
  amountOfLinks: links?._embedded?.patientLink?.length ?? undetermined,
  enrolled: person?.enrolled ?? undetermined,
  enroller: person?.enrollmentSummary?.enroller || undetermined,
  enrollmentDate: person?.enrollmentSummary?.dateEnrolled || undetermined,
});

async function jitterInsideChunk(): Promise<void> {
  return Util.sleepRandom(JITTER_DELAY_MAX_MS, JITTER_DELAY_MIN_PCT / 100);
}

async function sleepBetweenChunks(): Promise<void> {
  return Util.sleepRandom(CHUNK_DELAY_MAX_MS, CHUNK_DELAY_MIN_PCT / 100);
}
