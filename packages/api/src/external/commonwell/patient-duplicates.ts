import { getId } from "@metriport/commonwell-sdk";
import stringify from "json-stringify-safe";
import { chunk, groupBy } from "lodash";
import { Patient, PatientModel } from "../../models/medical/patient";
import { filterTruthy } from "../../shared/filter-map-utils";
import { capture } from "../../shared/notifications";
import { oid } from "../../shared/oid";
import { Util } from "../../shared/util";
import { MedicalDataSource } from "../index";
import { makeCommonWellAPI, organizationQueryMeta } from "./api";
import { PatientDataCommonwell, getPatientData } from "./patient-shared";

const MAX_QUERIES_IN_PARALLEL = 10;

const JITTER_DELAY_MAX_MS = 500; // in milliseconds
const JITTER_DELAY_MIN_PCT = 30; // 1-100% of max delay

const CHUNK_DELAY_MAX_MS = 500; // in milliseconds
const CHUNK_DELAY_MIN_PCT = 50; // 1-100% of max delay

/**
 * personId might be the actual personId or "falsy" to indicate that the personId is `null | undefined`
 */
export type DuplicatedPersonsOfPatient = {
  // each person ID and the number of links it has to patients
  [personId: string]: {
    amountOfLinks?: number;
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
      amountOfLinks?: number;
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
  const { log } = Util.out(`findDuplicatedPersons`);
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

    const chunks = chunk(patients, MAX_QUERIES_IN_PARALLEL);
    const n = chunks.length;
    for (const [i, chunk] of chunks.entries()) {
      log(`Running chunk ${i + 1}/${n})...`);

      await Promise.allSettled(
        chunk.map(async patient => {
          await jitterInsideChunk(); // add some randomness before each request
          personByCx[patient.id] = await findDuplicatedPersonsByPatient(patient);
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
  patient: Patient
): Promise<DuplicatedPersonsOfPatient | undefined> {
  try {
    const facilityId = patient.facilityIds[0];
    if (!facilityId) {
      console.log(`Patient ${patient.id} has no facilityId, skipping...`);
      return failed("missing-facility-id", true);
    }
    const commonwellData = patient.data.externalData
      ? (patient.data.externalData[MedicalDataSource.COMMONWELL] as PatientDataCommonwell)
      : undefined;
    if (!commonwellData) {
      console.log(`Patient ${patient.id} has no externalData for CommonWell, skipping...`);
      return failed("missing-external-data", true);
    }
    const cwPatientId = commonwellData.patientId;
    const storedPersonId = commonwellData.personId;

    // Get Org info to setup API access
    const { organization, facility } = await getPatientData(patient, facilityId);
    const orgName = organization.data.name;
    const orgId = organization.id;
    const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`

    const commonWell = makeCommonWellAPI(orgName, oid(orgId));
    const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

    const respSearch = await commonWell.searchPersonByPatientDemo(queryMeta, cwPatientId);

    const persons = respSearch._embedded?.person
      ? respSearch._embedded.person.flatMap(p => (p && getId(p) ? p : []))
      : [];
    const filteredPersons = persons.flatMap(filterTruthy);
    if (filteredPersons.length === 1) {
      const thePerson = filteredPersons[0];
      const foundPersonId = getId(thePerson);
      if (foundPersonId === storedPersonId && storedPersonId != undefined) {
        console.log(`Good! No duplicates found for patient ${patient.id} AND person IDs match!`);
        return undefined;
      } else {
        console.log(
          `No duplicates found for patient ${patient.id}, but person IDs dont match or are falsy (stored: ${storedPersonId}, found: ${foundPersonId})`
        );
        const [foundPersonLinks, storedPerson, storedPersonLinks] = await Promise.all([
          foundPersonId ? commonWell.getPatientLinks(queryMeta, foundPersonId) : undefined,
          storedPersonId ? commonWell.getPersonById(queryMeta, storedPersonId) : undefined,
          storedPersonId ? commonWell.getPatientLinks(queryMeta, storedPersonId) : undefined,
        ]);
        return {
          [foundPersonId ?? "falsy"]: {
            ...(foundPersonLinks
              ? {
                  amountOfLinks: foundPersonLinks._embedded?.patientLink?.length || 0,
                  enroller: thePerson?.enrollmentSummary?.enroller || "unknown",
                  enrollmentDate: thePerson?.enrollmentSummary?.dateEnrolled || "unknown",
                }
              : {}),
            mismatchLocalId: {
              id: storedPersonId ?? "falsy",
              ...(storedPersonLinks
                ? {
                    amountOfLinks: storedPersonLinks._embedded?.patientLink?.length || 0,
                    enroller: storedPerson?.enrollmentSummary?.enroller || "unknown",
                    enrollmentDate: storedPerson?.enrollmentSummary?.dateEnrolled || "unknown",
                  }
                : {}),
            },
          },
        };
      }
    } else if (filteredPersons.length < 1) {
      console.log(`Ouch, no person found for patient ${patient.id} - we should look into this!`);
      return failed("no-person-found-at-cw");
    }
    console.log(`Found ${filteredPersons.length} persons for patient ${patient.id}`);

    const personIds = filteredPersons.map(getId).flatMap(filterTruthy);
    if (personIds.length < 1) {
      console.log(`Got FALSY person IDs for patient ${patient.id} - we should look into this!`);
      return failed("falsy-person-id");
    }

    const res: DuplicatedPersonsOfPatient = {};

    // for each person, get their enrolment details
    for (const person of filteredPersons) {
      const personId = getId(person);
      if (!personId) {
        console.log(
          `Got a person without ID for patient ${patient.id}, skipping - ${stringify(person)}`
        );
        continue;
      }
      const patientLinks = await commonWell.getPatientLinks(queryMeta, personId);
      res[personId] = {
        amountOfLinks: patientLinks._embedded?.patientLink?.length || 0,
        enroller: person.enrollmentSummary?.enroller || "unknown",
        enrollmentDate: person.enrollmentSummary?.dateEnrolled || "unknown",
        ...(storedPersonId === personId ? { isMetriport: true } : {}),
      };
    }
    return res;
  } catch (error) {
    const msg = "Error while checking duplicates for patient";
    console.log(`${msg} ${patient.id} - error: ${stringify(error)}`);
    capture.message(msg, {
      extra: { context: `findDuplicatedPersonsByPatient`, patient, error },
      level: "error",
    });
    return undefined;
  }
}

async function jitterInsideChunk(): Promise<void> {
  return Util.sleepRandom(JITTER_DELAY_MAX_MS, JITTER_DELAY_MIN_PCT / 100);
}

async function sleepBetweenChunks(): Promise<void> {
  return Util.sleepRandom(CHUNK_DELAY_MAX_MS, CHUNK_DELAY_MIN_PCT / 100);
}
