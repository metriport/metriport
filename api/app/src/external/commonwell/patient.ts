import {
  AddressUseCodes,
  getIdTrailingSlash,
  IdentifierUseCodes,
  NameUseCodes,
  Patient as CommonwellPatient,
} from "@metriport/commonwell-sdk";
import dayjs from "dayjs";
import { nanoid } from "nanoid";
import { getPatientWithDependencies } from "../../command/medical/patient/get-patient";
import { setCommonwellId } from "../../command/medical/patient/update-patient";
import { Patient, PatientDataExternal } from "../../models/medical/patient";
import { driversLicenseURIs, oid } from "../../shared/oid";
import { makeCommonWellAPI, organizationQueryMeta } from "./api";

export class PatientDataCommonwell extends PatientDataExternal {}

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

export async function create(patient: Patient, facilityId: string): Promise<void> {
  const { organization, facilities } = await getPatientWithDependencies(patient);

  const facility = facilities.find(f => f.id === facilityId);
  if (!facility)
    throw new Error(`Couldn not find facility ${facilityId} with patient ${patient.id}`);

  const orgName = organization.data.name;
  const orgId = organization.id;
  const facilityNPI = facility.data["npi"] as string; // TODO #369 move to strong type - remove `as string`

  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });
  const cwPatient = patientToCommonwell({ patient, orgName, orgId });

  console.log(`[queryMeta] ${JSON.stringify(queryMeta, undefined, 2)}`);
  console.log(`[cwPatient] ${JSON.stringify(cwPatient, undefined, 2)}`);

  let commonwellPatientId: string | undefined = undefined;
  try {
    const commonWell = makeCommonWellAPI(orgName, oid(orgId));
    const newPatient = await commonWell.registerPatient(queryMeta, cwPatient);
    console.log(`[CW REST PATIENT REGISTRATION] `, newPatient);
    commonwellPatientId = getIdTrailingSlash(newPatient);
    if (!commonwellPatientId) {
      // TODO #156 Send this to Sentry
      console.error(
        `Could not determine the patient ID from Commonwell! ` +
          `Metriport patient ID ${patient.id}, patient @ Commonwell: ${JSON.stringify(newPatient)}`
      );
      return;
    }
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    // TODO #156 Send this to Sentry
    console.error(`Failed to create patient ${patient.id} @ Commonwell: ${err.message}`);
    throw err;
  }

  try {
    // update the patient with the ID from CW
    await setCommonwellId({
      patientId: patient.id,
      cxId: patient.cxId,
      commonwellPatientId,
    });
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error(
      `Failed to udpate patient ${patient.id} after inserting on Commonwell: ${err.message}`
    );
    throw err;
  }
}

// export async function update({
//   orgName,
//   facilityNPI,
//   patient,
// }: {
//   orgName: string;
//   facilityNPI: string;
//   patient: Patient;
// }) {
//   const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });
//   const cwPatient = patientToCommonwell(patient);

//   const patientDataExternal = patient.data.externalData[ExternalMedicalPartners.COMMONWELL];

//   // update the patient
//   const respD2a = await commonWell.updatePatient(queryMeta, cwPatient, patientDataExternal.id);

//   // update the person
//   const respC3a = await commonWell.updatePerson(queryMeta, personStrongId, personId);
// }
