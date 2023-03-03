import {
  AddressUseCodes,
  CommonWell,
  getId,
  getIdTrailingSlash,
  IdentifierUseCodes,
  NameUseCodes,
  Patient as CommonwellPatient,
  Person as CommonwellPerson,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import dayjs from "dayjs";
import { nanoid } from "nanoid";
import { getPatientWithDependencies } from "../../command/medical/patient/get-patient";
import { setCommonwellId } from "../../command/medical/patient/update-patient";
import { Facility } from "../../models/medical/facility";
import { Organization } from "../../models/medical/organization";
import { Patient, PatientDataExternal } from "../../models/medical/patient";
import { driversLicenseURIs, oid } from "../../shared/oid";
import { Util } from "../../shared/util";
import { makeCommonWellAPI, organizationQueryMeta } from "./api";

export class PatientDataCommonwell extends PatientDataExternal {
  constructor(private personId: string, private patientId: string) {
    super();
  }
}

export async function create(patient: Patient, facilityId: string): Promise<void> {
  const { organization, facility } = await getPatientData(patient, facilityId);

  const orgName = organization.data.name;
  const orgId = organization.id;
  const facilityNPI = facility.data["npi"] as string; // TODO #369 move to strong type - remove `as string`

  const { commonwellPatientId, commonwellPersonId } = await createPatientAtCommonwell({
    patient,
    orgName,
    orgId,
    facilityNPI,
  });

  // Update our DB with the ID from CW
  await setCommonwellId({
    patientId: patient.id,
    cxId: patient.cxId,
    commonwellPatientId,
    commonwellPersonId,
  });
}

async function createPatientAtCommonwell({
  patient,
  orgName,
  orgId,
  facilityNPI,
}: {
  patient: Patient;
  orgName: string;
  orgId: string;
  facilityNPI: string;
}): Promise<{ commonwellPatientId: string; commonwellPersonId: string }> {
  const log = Util.log(`CW Patient - ${patient.id}`);

  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });
  const cwPatient = patientToCommonwell({ patient, orgName, orgId });

  // console.log(`[queryMeta] ${JSON.stringify(queryMeta, undefined, 2)}`);
  console.log(`[cwPatient] ${JSON.stringify(cwPatient, undefined, 2)}`);

  const commonWell = makeCommonWellAPI(orgName, oid(orgId));

  // REGISTER PATIENT
  const respPatient = await commonWell.registerPatient(queryMeta, cwPatient);
  log(`[CW REST PATIENT REGISTRATION] `, respPatient);
  const commonwellPatientId = getIdTrailingSlash(respPatient);
  if (!commonwellPatientId) {
    const msg = `Could not determine the patient ID from CW`;
    log(
      `${msg} - Patient created @ CW but not the Person - ` +
        `Metriport patient ID ${patient.id}, patient @ Commonwell: ${JSON.stringify(respPatient)}`
    );
    throw new Error(msg);
  }
  const patientRefLink = respPatient._links?.self?.href;
  if (!patientRefLink) {
    const msg = `Could not determine the patient ref link`;
    log(
      `${msg} - Patient created @ CW but not the Person - ` +
        `Metriport patient ID ${patient.id}, patient @ Commonwell: ${JSON.stringify(respPatient)}`
    );
    throw new Error(msg);
  }

  // FIND OR CREATE PERSON
  let commonwellPersonId;
  try {
    const person = makePersonForPatient(cwPatient);
    commonwellPersonId = await findOrCreatePerson({ commonWell, queryMeta, person });
  } catch (err) {
    log(`Patient created @ CW but could not find/create Person`);
    throw err;
  }

  // LINK THEM
  await commonWell.patientLink(queryMeta, commonwellPersonId, patientRefLink);

  // NETWORK LINKS
  // TODO

  return { commonwellPatientId, commonwellPersonId };
}

function makePersonForPatient(cwPatient: CommonwellPatient): CommonwellPerson {
  return {
    details: cwPatient.details,
  };
}

async function findOrCreatePerson({
  commonWell,
  queryMeta,
  person,
}: {
  commonWell: CommonWell;
  queryMeta: RequestMetadata;
  person: CommonwellPerson;
}): Promise<string> {
  // SEARCH PERSON WITH STRONG ID OR DEMOGRAPHICS
  // TODO #369
  // TODO #369
  // TODO #369

  // IF NOT FOUND - ENROLL PERSON
  console.log(`Enrolling this person: ${JSON.stringify(person, null, 2)}`);

  const respPerson = await commonWell.enrollPerson(queryMeta, person);
  console.log(`[CW REST PERSON ENROLL] `, respPerson);
  const personId = getId(respPerson);
  if (!personId) {
    const msg = `Could not get person ID from CW response`;
    console.log(`${msg} - CW response: ${JSON.stringify(respPerson)}`);
    throw new Error(msg);
  }
  return personId;
}

// export async function update(patient: Patient, facilityId: string): Promise<void> {
//   const commonwellPatientId = patient.data.externalData
//     ? patient.data.externalData[ExternalMedicalPartners.COMMONWELL].id
//     : undefined;
//   if (!commonwellPatientId) throw new Error(`Missing commonwell ID on patient ${patient.id}`);

//   const { organization, facility } = await getPatientData(patient, facilityId);

//   const orgName = organization.data.name;
//   const orgId = organization.id;
//   const facilityNPI = facility.data["npi"] as string; // TODO #369 move to strong type - remove `as string`

//   const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });
//   const cwPatient = patientToCommonwell({ patient, orgName, orgId });

//   try {
//     const commonWell = makeCommonWellAPI(orgName, oid(orgId));

//     // update the patient
//     const respPatient = await commonWell.updatePatient(queryMeta, cwPatient, commonwellPatientId);
//     console.log(`[CW REST PATIENT UPDATE] `, respPatient);

//     const respSearch = await commonWell.searchPersonByPatientDemo(queryMeta, commonwellPatientId);
//     console.log(respSearch);
//     const personId = getPersonIdFromSearchByPatientDemo(respSearch);
//     if (!personId) {
//       const msg = `Could not determine the CW person ID for patient ${patient.id}`;
//       console.log(`${msg} - Patient updated @ CW but not the Person`);
//       throw new Error(msg);
//     }
//     const personList = respSearch._embedded?.person;
//     if (!personList) {
//       const msg = `Could not get person from CW response - patient ${patient.id}`;
//       console.log(
//         `${msg} - Patient updated @ CW but not the Person - ` +
//           `Response from CW: ${JSON.stringify(respSearch)}`
//       );
//       throw new Error(msg);
//     }
//     if (personList.length !== 1) {
//       const msg = `Got more than one person from CW response - patient ${patient.id}`;
//       console.log(
//         `${msg} - Patient updated @ CW but not the Person - ` +
//           `Response from CW: ${JSON.stringify(respSearch)}`
//       );
//     }
//     const person = personList.length;

//     // update the person
//     const respPerson = await commonWell.updatePerson(queryMeta, personList, personId);
//     console.log(`[CW REST PATIENT REGISTRATION] `, newPatient);

//     //eslint-disable-next-line @typescript-eslint/no-explicit-any
//   } catch (err: any) {
//     // TODO #156 Send this to Sentry
//     console.error(`Failed to create patient ${patient.id} @ Commonwell: ${err.message}`);
//     throw err;
//   }
// }

function patientToCommonwell({
  patient,
  orgName,
  orgId,
}: {
  patient: Patient;
  orgName: string;
  orgId: string;
}): CommonwellPatient {
  const identifier = {
    use: IdentifierUseCodes.usual,
    label: orgName,
    system: oid(orgId),
    key: patient.id,
    assigner: orgName,
  };
  // TODO make this optional
  const strongIdentifier = {
    use: IdentifierUseCodes.usual,
    // key: patient.data.driversLicense,
    key: nanoid(), // TODO #369 make this dynamic
    system: driversLicenseURIs.CA, // TODO #369 make this dynamic
    period: {
      start: dayjs().toISOString(), // TODO #369 get this form the UI as well?
    },
  };
  return {
    identifier: [identifier],
    details: {
      address: [
        {
          use: AddressUseCodes.home,
          zip: patient.data.address.zip,
          state: patient.data.address.state,
          line: [patient.data.address.addressLine1],
          city: patient.data.address.city,
        },
      ],
      name: [
        {
          use: NameUseCodes.usual,
          given: [patient.data.firstName],
          family: [patient.data.lastName],
        },
      ],
      gender: {
        code: "M", // TODO #369 ADD THIS
      },
      birthDate: patient.data.dob,
      ...(strongIdentifier ? { identifier: [strongIdentifier] } : undefined),
    },
  };
}

async function getPatientData(
  patient: Patient,
  facilityId: string
): Promise<{
  organization: Organization;
  facility: Facility;
}> {
  const { organization, facilities } = await getPatientWithDependencies(patient);

  const facility = facilities.find(f => f.id === facilityId);
  if (!facility)
    throw new Error(`Couldn not find facility ${facilityId} with patient ${patient.id}`);

  return { organization, facility };
}
