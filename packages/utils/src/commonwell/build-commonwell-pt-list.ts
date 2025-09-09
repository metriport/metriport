import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { decodeCwPatientIdV1 } from "@metriport/commonwell-sdk/common/util";
import { getFirstNameAndMiddleInitial, Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { sleep } from "@metriport/core/util/sleep";
import {
  normalizeDob,
  normalizeEmail,
  normalizeGender,
  normalizePhoneNumber,
  normalizeUSStateForAddress,
  normalizeZipCodeNew,
  toTitleCase,
} from "@metriport/shared";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { Sequelize } from "sequelize";
import path from "path";
import { buildGetDirPathInside } from "../shared/folder";

dayjs.extend(duration);

/**
 * This script exports patients from the database to Commonwell CSV format between the two given dates.
 *
 * Required environment variables:
 *   - DB_CREDS: JSON string with database credentials
 *
 * To run:
 * - Set the fromDate and toDate
 * - Run the script with `ts-node src/commonwell/build-commonwell-pt-list.ts`
 */

// Commonwell Patient CSV Schema
const csvHeader = [
  "OrganizationID",
  "AAID",
  "PatientID",
  "DOB",
  "Sex",
  "FirstName",
  "MiddleInitial",
  "LastName",
  "Address1",
  "Address2",
  "City",
  "State",
  "Zip",
  "HomePhone",
  "CellPhone",
  "Email",
];

type CommonwellPatient = {
  organizationId: string;
  aaid: string;
  patientId: string;
  dob: string;
  sex: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  homePhone?: string;
  cellPhone?: string;
  email?: string;
};

const getFolderName = buildGetDirPathInside(`commonwell-export`);

type Params = {
  organizationId?: string;
  aaid?: string;
  outputFile?: string;
};

const program = new Command();
program
  .name("build-commonwell-pt-list")
  .description("CLI to export patients from database to Commonwell CSV format.")
  .showHelpAfterError();

const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
const dbCreds = JSON.parse(sqlDBCreds);

const fromDate = "2025-09-06"; // Use `YYYY-MM-DD HH:MM:SS` format
const toDate = "2025-09-08"; // Use `YYYY-MM-DD HH:MM:SS` format

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();

  const sequelize = new Sequelize(dbCreds.dbname, dbCreds.username, dbCreds.password, {
    host: dbCreds.host,
    port: dbCreds.port,
    dialect: dbCreds.engine,
  });

  program.parse();
  const { outputFile } = program.opts<Params>();

  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);

  try {
    // STEP 1: Query patients from the database
    console.log("STEP 1: Querying patients from database...");
    const patientResults = await sequelize.query(
      `SELECT * FROM patient WHERE created_at > :fromDate and created_at < :toDate`,
      {
        replacements: { fromDate, toDate },
      }
    );
    const patients = patientResults[0] as Patient[];
    console.log(`Found ${patients.length} patients in database`);

    // STEP 2: Create Commonwell Patient objects
    console.log("STEP 2: Converting patients to Commonwell format...");
    const commonwellPatients: CommonwellPatient[] = [];
    const conversionErrors: Array<{ patientId: string; error: string }> = [];

    for (const patient of patients) {
      try {
        const cwData = patient.data.externalData?.[MedicalDataSource.COMMONWELL] as {
          patientId?: string | undefined;
        };
        if (!cwData?.patientId) continue;

        const cwPatientId = cwData.patientId;
        const cwIds = decodeCwPatientIdV1(cwPatientId);
        if (!cwIds.value || !cwIds.assignAuthority) continue;
        const orgOid = cwIds.assignAuthority.replace("urn:oid:", "");
        const commonwellPatient = mapPatientToCommonwell(patient, orgOid);
        commonwellPatients.push(commonwellPatient);
      } catch (error) {
        conversionErrors.push({
          patientId: patient.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (conversionErrors.length > 0) {
      console.warn(
        `Warning: ${conversionErrors.length} patients failed conversion:`,
        conversionErrors
      );
    }

    console.log(
      `Successfully converted ${commonwellPatients.length} patients to Commonwell format`
    );

    // STEP 3: Output to CSV file
    console.log("STEP 3: Writing Commonwell patients to CSV file...");
    const outputPath = outputFile ?? getOutputFilePath();
    await writeCommonwellPatientsToCSV(commonwellPatients, outputPath);
    console.log(`Successfully wrote ${commonwellPatients.length} patients to ${outputPath}`);

    console.log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
  } catch (error) {
    console.error("Error during execution:", error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

/**
 * Maps a Patient domain object to a CommonwellPatient object
 */
function mapPatientToCommonwell(patient: Patient, aaid: string): CommonwellPatient {
  // Validate required fields
  if (!patient.data.firstName) throw new Error("Missing firstName");
  if (!patient.data.lastName) throw new Error("Missing lastName");
  if (!patient.data.dob) throw new Error("Missing dob");
  if (!patient.data.genderAtBirth) throw new Error("Missing genderAtBirth");
  if (!patient.data.address?.[0]?.addressLine1) throw new Error("Missing addressLine1");
  if (!patient.data.address?.[0]?.city) throw new Error("Missing city");
  if (!patient.data.address?.[0]?.state) throw new Error("Missing state");
  if (!patient.data.address?.[0]?.zip) throw new Error("Missing zip");

  const address = patient.data.address[0];

  // Normalize and format data
  const normalizedDob = normalizeDob(patient.data.dob);
  const normalizedSex = normalizeGender(patient.data.genderAtBirth);
  const normalizedState = normalizeUSStateForAddress(address.state);
  const normalizedZip = normalizeZipCodeNew(address.zip);

  // Extract middle initial from firstName if present
  const { firstName, middleInitial } = getFirstNameAndMiddleInitial(patient.data.firstName);
  // const middleInitial = nameParts.length > 1 ? nameParts[1].charAt(0).toUpperCase() : undefined;

  // Extract phone numbers from contact array
  const homePhone = patient.data.contact?.find(c => c.phone)?.phone;
  const cellPhone = patient.data.contact?.find((c, index) => index > 0 && c.phone)?.phone;
  const email = patient.data.contact?.find(c => c.email)?.email;

  // Normalize phone numbers and email
  const normalizedHomePhone = homePhone ? normalizePhoneNumber(homePhone) : undefined;
  const normalizedCellPhone = cellPhone ? normalizePhoneNumber(cellPhone) : undefined;
  const normalizedEmail = email ? normalizeEmail(email) : undefined;

  return {
    organizationId: aaid,
    aaid,
    patientId: patient.id,
    dob: normalizedDob,
    sex: normalizedSex,
    firstName: toTitleCase(firstName),
    middleInitial,
    lastName: toTitleCase(patient.data.lastName),
    address1: toTitleCase(address.addressLine1),
    address2: address.addressLine2 ? toTitleCase(address.addressLine2) : undefined,
    city: toTitleCase(address.city),
    state: normalizedState,
    zip: normalizedZip,
    homePhone: normalizedHomePhone,
    cellPhone: normalizedCellPhone,
    email: normalizedEmail,
  };
}

/**
 * Writes CommonwellPatient objects to a CSV file
 */
async function writeCommonwellPatientsToCSV(
  patients: CommonwellPatient[],
  outputPath: string
): Promise<void> {
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Convert patients to CSV rows
  const csvRows = patients.map(patient => {
    function escapeCsvValue(value: string | undefined): string {
      if (!value) return "";
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const escaped = value.replace(/"/g, '""');
      return /[,"\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
    }

    return [
      escapeCsvValue(patient.organizationId),
      escapeCsvValue(patient.aaid),
      escapeCsvValue(patient.patientId),
      escapeCsvValue(patient.dob),
      escapeCsvValue(patient.sex),
      escapeCsvValue(patient.firstName),
      escapeCsvValue(patient.middleInitial),
      escapeCsvValue(patient.lastName),
      escapeCsvValue(patient.address1),
      escapeCsvValue(patient.address2),
      escapeCsvValue(patient.city),
      escapeCsvValue(patient.state),
      escapeCsvValue(patient.zip),
      escapeCsvValue(patient.homePhone),
      escapeCsvValue(patient.cellPhone),
      escapeCsvValue(patient.email),
    ].join(",");
  });

  const csvContent = [csvHeader.join(","), ...csvRows].join("\n");
  fs.writeFileSync(outputPath, csvContent, "utf8");
}

/**
 * Generates a default output file path with timestamp
 */
function getOutputFilePath(): string {
  const timestamp = dayjs().format("YYYY-MM-DD_HH-mm-ss");
  const folderName = getFolderName("commonwell-export");
  return `${folderName}/commonwell-patients-${timestamp}.csv`;
}

/**
 * Formats elapsed time as a human-readable string
 */
function elapsedTimeAsStr(startedAt: number): string {
  const elapsed = Date.now() - startedAt;
  const duration = dayjs.duration(elapsed);

  if (duration.asMinutes() < 1) {
    return `${Math.round(duration.asSeconds())}s`;
  } else if (duration.asHours() < 1) {
    return `${Math.round(duration.asMinutes())}m ${Math.round(duration.seconds())}s`;
  } else {
    return `${Math.round(duration.asHours())}h ${Math.round(duration.minutes())}m`;
  }
}

if (require.main === module) {
  main();
}
