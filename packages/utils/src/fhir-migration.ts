import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { MedplumClient } from "@medplum/core";
import { Organization as FHIROrganization, Patient as FHIRPatient } from "@medplum/fhirtypes";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { convertPIToIdentifier } from "@metriport/core/external/fhir/patient/index";
import { Sequelize } from "sequelize";

/**
 * Migrate existing orgs and patients to FHIR
 *
 * Requires env vars as indicated at start of this function.
 * Its suggested to set those on a .env file so they are not stored on
 * your shell history.
 *
 * Created as part of #521
 */
async function main() {
  const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
  const fhirUrl = getEnvVarOrFail("FHIR_URL");

  const dbCreds = JSON.parse(sqlDBCreds);

  const fhirApi = new MedplumClient({
    baseUrl: fhirUrl,
    fhirUrlPath: "fhir",
  });

  const sequelize = new Sequelize(dbCreds.dbname, dbCreds.username, dbCreds.password, {
    host: dbCreds.host,
    port: dbCreds.port,
    dialect: dbCreds.engine,
  });

  const orgResults = await sequelize.query("SELECT * FROM organization");
  const organizations = orgResults[0];

  for (const org of organizations) {
    const fhirOrg = toFHIROrg(org);
    await fhirApi.updateResource(fhirOrg);
  }

  const patientResults = await sequelize.query("SELECT * FROM patient");
  const patients = patientResults[0];

  for (const patient of patients) {
    const fhirPatient = toFHIRPatient(patient);
    await fhirApi.updateResource(fhirPatient);
  }

  console.log(`Done`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toFHIROrg = (org: any): FHIROrganization => {
  return {
    resourceType: "Organization",
    id: org.id,
    active: true,
    type: [
      {
        text: org.data.type,
      },
    ],
    name: org.data.name,
    address: [
      {
        line: [org.data.location.addressLine1],
        city: org.data.location.city,
        state: org.data.location.state,
        postalCode: org.data.location.zip,
        country: org.data.location.country,
      },
    ],
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toFHIRPatient = (patient: any): FHIRPatient => {
  return {
    resourceType: "Patient",
    id: patient.id,
    identifier: convertPIToIdentifier(patient.data.personalIdentifiers),
    name: [
      {
        family: patient.data.lastName,
        given: [patient.data.firstName],
      },
    ],
    telecom: patient.data.contact
      ? Object.entries(patient.data.contact).map(([key, val]) => {
          return {
            system: key === "phone" ? "phone" : "email",
            value: val as string,
          };
        })
      : undefined,
    gender:
      patient.data.genderAtBirth === "F"
        ? "female"
        : patient.data.genderAtBirth === "M"
        ? "male"
        : "unknown",
    birthDate: patient.data.dob,
    address: [
      {
        line: [patient.data.address.addressLine1],
        city: patient.data.address.city,
        state: patient.data.address.state,
        postalCode: patient.data.address.zip,
        country: patient.data.address.country,
      },
    ],
  };
};

main();
