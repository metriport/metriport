import {
  AddressUseCodes,
  CommonWell,
  getId,
  getIdTrailingSlash,
  Identifier,
  IdentifierUseCodes,
  NameUseCodes,
  Patient as CommonwellPatient,
  Person as CommonwellPerson,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { ExternalMedicalPartners } from "..";
import { getPatientWithDependencies } from "../../command/medical/patient/get-patient";
import { setCommonwellId } from "../../command/medical/patient/update-patient";
import { Facility } from "../../models/medical/facility";
import { Organization } from "../../models/medical/organization";
import {
  Gender,
  generalTypes,
  Patient,
  PatientData,
  PatientDataExternal,
} from "../../models/medical/patient";
import { driversLicenseURIs, medicareURI, oid, passportURI, ssnURI } from "../../shared/oid";
import { Util } from "../../shared/util";
import { makeCommonWellAPI, organizationQueryMeta } from "./api";

const genderMapping: { [k in Gender]: string } = {
  F: "F",
  M: "M",
  O: "UN",
  U: "UN",
};

export class PatientDataCommonwell extends PatientDataExternal {
  constructor(public personId: string, public patientId: string) {
    super();
  }
}

export async function create(patient: Patient, facilityId: string): Promise<void> {
  const { organization, facility } = await getPatientData(patient, facilityId);

  const orgName = organization.data.name;
  const orgId = organization.id;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`

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
  const log = Util.log(`Create CW Patient - ${patient.id}`);

  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });
  const cwPatient = patientToCommonwell({ patient, orgName, orgId });

  console.log(`[cwPatient] ${JSON.stringify(cwPatient, undefined, 2)}`); // TODO #369 remove this

  const commonWell = makeCommonWellAPI(orgName, oid(orgId));

  // REGISTER PATIENT
  const respPatient = await commonWell.registerPatient(queryMeta, cwPatient);
  log(`[CW REST PATIENT REGISTRATION] `, respPatient); // TODO #369 remove this
  const commonwellPatientId = getIdTrailingSlash(respPatient);
  if (!commonwellPatientId) {
    const msg = `Could not determine the patient ID from CW`;
    log(
      `${msg} - Patient created @ CW but not the Person - ` +
        `Patient @ Commonwell: ${JSON.stringify(respPatient)}`
    );
    throw new Error(msg);
  }
  const patientRefLink = respPatient._links?.self?.href;
  if (!patientRefLink) {
    const msg = `Could not determine the patient ref link`;
    log(
      `${msg} - Patient created @ CW but not the Person - ` +
        `Patient @ Commonwell: ${JSON.stringify(respPatient)}`
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

// TODO finish alternative flows
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

  // IF NOT FOUND - ENROLL PERSON
  console.log(`Enrolling this person: ${JSON.stringify(person, null, 2)}`); // TODO #369 remove this

  const respPerson = await commonWell.enrollPerson(queryMeta, person);
  console.log(`[CW REST PERSON ENROLL] `, respPerson); // TODO #369 remove this
  const personId = getId(respPerson);
  if (!personId) {
    const msg = `Could not get person ID from CW response`;
    console.log(`${msg} - CW response: ${JSON.stringify(respPerson)}`);
    throw new Error(msg);
  }
  return personId;
}

export async function update(patient: Patient, facilityId: string): Promise<void> {
  const log = Util.log(`Update CW Patient - ${patient.id}`);

  const commonwellData = patient.data.externalData
    ? (patient.data.externalData[ExternalMedicalPartners.COMMONWELL] as PatientDataCommonwell) // TODO validate the type
    : undefined;
  if (!commonwellData) throw new Error(`Missing commonwell data on patient ${patient.id}`);
  const commonwellPatientId = commonwellData.patientId;
  const commonwellPersonId = commonwellData.personId;

  const { organization, facility } = await getPatientData(patient, facilityId);
  const orgName = organization.data.name;
  const orgId = organization.id;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`

  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });
  const cwPatient = patientToCommonwell({ patient, orgName, orgId });
  const commonWell = makeCommonWellAPI(orgName, oid(orgId));

  // UDPATE PATIENT
  const respPatient = await commonWell.updatePatient(queryMeta, cwPatient, commonwellPatientId);
  log(`[CW RESP PATIENT UPDATE] `, respPatient); // TODO #369 remove this

  // UDPATE PERSON
  try {
    const person = makePersonForPatient(cwPatient);
    const respPerson = await commonWell.updatePerson(queryMeta, person, commonwellPersonId);
    log(`[CW RESP PERSON UPDATE] `, respPerson); // TODO #369 remove this
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    log(
      `Failed to update patient - Patient updated @ CW but not the Person - ` +
        `Patient @ CW: ${commonwellPatientId}, ` +
        `Person @ CW: ${commonwellPersonId}`
    );
    throw err;
  }

  // REVIEW PERSON-PATIENT LINK
  try {
    // Make sure the link between person and patient exists and its LOLA2
    // TODO #369
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    log(
      `Failed to validate patient/person link - ` +
        `Patient @ CW: ${commonwellPatientId}, ` +
        `Person @ CW: ${commonwellPersonId}`
    );
    throw err;
  }
}

const identifierSytemByType: Record<(typeof generalTypes)[number], string> = {
  ssn: ssnURI,
  passport: passportURI,
  medicare: medicareURI,
};

function getStrongIdentifiers(data: PatientData): Identifier[] {
  return data.personalIdentifiers.map(id => ({
    use: IdentifierUseCodes.usual,
    key: id.value,
    system:
      id.type === "driversLicense" ? driversLicenseURIs[id.state] : identifierSytemByType[id.type],
    period: id.period,
    ...(id.assigner ? { assigner: id.assigner } : undefined),
  }));
}

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
  const strongIdentifiers = getStrongIdentifiers(patient.data);
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
        code: genderMapping[patient.data.gender],
      },
      birthDate: patient.data.dob,
      ...(strongIdentifiers.length > 0 ? { identifier: strongIdentifiers } : undefined),
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
