import { getId } from "@metriport/commonwell-sdk";
import stringify from "json-stringify-safe";
import { groupBy } from "lodash";
import { Patient, PatientModel } from "../../models/medical/patient";
import { filterTruthy } from "../../shared/filter-map-utils";
import { oid } from "../../shared/oid";
import { Util } from "../../shared/util";
import { MedicalDataSource } from "../index";
import { makeCommonWellAPI, organizationQueryMeta } from "./api";
import { PatientDataCommonwell, getPatientData } from "./patient-shared";

export type DuplicatedPersonsOfPatient = {
  // each person ID and the number of links it has to patients
  [personId: string]: {
    amountOfLinks: number;
    enroller: string;
    enrollmentDate: string;
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

    // TODO consider moving this to Promise.all()
    for (const patient of patients) {
      personByCx[patient.id] = await findDuplicatedPersonsByPatient(patient);
    }

    res[cxId] = personByCx;
  }

  return res;
}

export async function findDuplicatedPersonsByPatient(
  patient: Patient
): Promise<DuplicatedPersonsOfPatient | undefined> {
  const facilityId = patient.facilityIds[0];
  if (!facilityId) {
    console.log(`Patient ${patient.id} has no facilityId, skipping...`);
    return undefined;
  }
  const commonwellData = patient.data.externalData
    ? (patient.data.externalData[MedicalDataSource.COMMONWELL] as PatientDataCommonwell)
    : undefined;
  if (!commonwellData) {
    console.log(`Patient ${patient.id} has no externalData for CommonWell, skipping...`);
    return undefined;
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
    const foundPersonId = getId(filteredPersons[0]);
    if (foundPersonId === storedPersonId) {
      console.log(`Good! No duplicates found for patient ${patient.id} AND person IDs match!`);
      return undefined;
    } else {
      console.log(`
        No duplicates found for patient ${patient.id}, but person IDs 
        dont match (stored: ${storedPersonId}, found: ${foundPersonId})
      `);
      return undefined;
    }
  } else if (filteredPersons.length < 1) {
    console.log(`Ouch, no person found for patient ${patient.id} - we should look into this!`);
    return undefined;
  }
  console.log(`Found ${filteredPersons.length} persons for patient ${patient.id}`);

  const personIds = filteredPersons.map(getId).flatMap(filterTruthy);
  if (personIds.length < 1) {
    console.log(`Got UNDEFINED person IDs for patient ${patient.id} - we should look into this!`);
    return undefined;
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
    };
  }
  return res;
}
