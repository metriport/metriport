import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Facility } from "@metriport/api-sdk";
import { FacilityInternalDetails, FacilityType } from "@metriport/core/domain/facility";
import {
  buildInternalFacilityFromNpiFacility,
  getFacilityByNpiOrFail,
} from "@metriport/core/external/npi-registry/npi-registry";
import { errorToString, getEnvVarOrFail, sleep } from "@metriport/shared";
import axios from "axios";
import { Command } from "commander";
import csvParser from "csv-parser";
import dayjs, { duration } from "dayjs";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { endScript, startScript } from "../utils";
import { createCsv, getInternalFacilityByNpi, readFileFromLocal, verifyFacilities } from "./utils";
import { AdditionalInformationInternalFacility } from "@metriport/core/domain/npi-facility";

dayjs.extend(duration);
/**
 * Bulk creates facilities.
 *
 * Reads facilities in bulk from a CSV file containing NPIs, facilityName, type, and principalOid.
 * Creates the facilities in the internal API, CareQuality, and CommonWell, then verifies their creation.
 *
 * Outputs the result of processing into runs/import-facility/timestamp with the name inputted and _result appended.
 *
 * Set the variables below to configure the script.
 * Ask the team for approval before running.
 *
 * Usage:
 * $ ts-node src/facility/bulk-import-facility --input-path <inputpath> --cx-id <cxId> --dryrun
 */

const internalUrl = getEnvVarOrFail("API_URL");
const verifyNames = true;
const useNpiDbName = false; // Needs to be opposite of useNameFromCsv and verifyNames must be false
const useNameFromCsv = false; // Needs to be opposite of useNpiDbName and verifyNames must be false
const waitTimeBetweenChecks = dayjs.duration(1, "seconds"); // Note that CW and CQ are notoriously slow. Sending too many requests will cause broken facilities.

interface FacilityImportParams {
  cxId: string;
  inputPath: string;
  dryrun?: boolean;
}

export const InputRowSchema = z.object({
  npi: z.string(),
  facilityName: z.string(),
  type: z.nativeEnum(FacilityType),
  principalOid: z.string().optional(),
});
export type InputRowFacilityImport = z.infer<typeof InputRowSchema>;

const CSV_HEADER =
  ["npi", "facilityName", "type", "principalOid", "success", "reason"].join(",") + "\n";

async function main({ cxId, inputPath, dryrun }: FacilityImportParams) {
  const isDryRun = Boolean(dryrun);
  const name = path.basename(inputPath, path.extname(inputPath));

  const startedAt = await startScript({
    nameOfScript: "bulk-import-facility",
    dryRun: isDryRun,
    optionalParams: {
      cxId,
      internalUrl,
    },
  });
  const outputTimeStamp = startedAt.toISOString();

  const logsFolder = `runs/import-facility/${outputTimeStamp}`;
  const resultFileName = `${name}_result${isDryRun ? "_dryrun" : ""}.csv`;

  const logsFilePath = `${logsFolder}/${resultFileName}`;
  const payloadCreatesFilePath = `${logsFolder}/${name}_facility-creates${
    isDryRun ? "_dryrun" : ""
  }.json`;

  await createCsv(logsFilePath, CSV_HEADER);

  const rows = await readCsvRows(inputPath);
  const createdFacilities: FacilityInternalDetails[] = [];

  for (const row of rows) {
    const facility = await processRow(row, cxId, isDryRun, logsFilePath);
    if (facility) {
      createdFacilities.push(facility);
    }
    await sleep(waitTimeBetweenChecks.asMilliseconds());
  }
  console.log(
    `${isDryRun ? "Would have created" : "Successfully created"} ${
      createdFacilities.length
    } facilities`
  );

  await fs.writeFile(payloadCreatesFilePath, JSON.stringify(createdFacilities, null, 2), "utf8");
  console.log(`JSON of the facilities that would have been created: ${payloadCreatesFilePath}`);
  console.log(`CSV of the results: ${logsFilePath}`);

  if (!isDryRun) {
    console.log(`Verifying ${createdFacilities.length} facilities`);
    await verifyFacilities({
      npis: createdFacilities.map(facility => facility.npi),
      cxId,
      timeout: waitTimeBetweenChecks.asMilliseconds(),
    });
  }

  await endScript({
    nameOfScript: "bulk-import-facility",
    startedAt,
  });
}

async function readCsvRows(inputPath: string): Promise<InputRowFacilityImport[]> {
  const rows: InputRowFacilityImport[] = [];
  const parser = csvParser({
    headers: ["npi", "facilityName", "type", "principalOid"],
    skipLines: 1,
  });

  await new Promise<void>((resolve, reject) => {
    parser.on("data", (row: InputRowFacilityImport) => {
      rows.push(row);
    });
    parser.once("end", resolve);
    parser.once("error", reject);
    readFileFromLocal(inputPath, parser).catch(reject);
  });

  return rows;
}

async function processRow(
  row: InputRowFacilityImport,
  cxId: string,
  isDryRun: boolean,
  logsFilePath: string
): Promise<FacilityInternalDetails | undefined> {
  let rowSuccess = true;
  let message: string | undefined = undefined;
  let nameUsed = row.facilityName;

  try {
    const npiFacility = await getFacilityByNpiOrFail(row.npi);

    const params: AdditionalInformationInternalFacility = {
      type: row.type,
      facilityName: row.facilityName,
      principalOid: row.principalOid,
      cqActive: true, // CQ and CW should always be true when importing facilities.
      cwActive: true,
    };

    const metriportFacility = buildInternalFacilityFromNpiFacility({
      npiFacility,
      additionalInfo: params,
    });

    const otherNames = npiFacility.other_names ?? [];
    if ((verifyNames || useNpiDbName) && otherNames.length > 0 && !useNameFromCsv) {
      const organizationName = otherNames[0].organization_name;
      if (!organizationName) {
        console.log(`Organization name was not returned from the NPI Registry for NPI: ${row.npi}`);
      }

      if (verifyNames && !facilityNamesMatch(organizationName, metriportFacility.nameInMetriport)) {
        throw new Error(
          `Name mismatch: Registry='${npiFacility.other_names[0].organization_name}', CSV='${metriportFacility.nameInMetriport}'`
        );
      }
      if (useNpiDbName) {
        metriportFacility.nameInMetriport = organizationName;
      }
    }
    const existingFacility = await getInternalFacilityByNpi(cxId, row.npi);
    if (existingFacility) {
      throw new Error(
        `Can't create a new facility with the same NPI as facility with ID: ${existingFacility.id} and name: ${existingFacility.name}`
      );
    }
    nameUsed = metriportFacility.nameInMetriport;
    if (!isDryRun) {
      await createFacility(metriportFacility, cxId);
    }
    console.log(
      `${isDryRun ? "Would have created" : "Successfully created"} facility with npi: ${row.npi}`
    );
    return metriportFacility;
  } catch (err: unknown) {
    rowSuccess = false;
    if (axios.isAxiosError(err) && err.response?.status === 400) {
      message = err.response.data?.detail ?? err.response.data?.title ?? err.message;
      console.log(message);
    } else {
      console.log(err);
      message = errorToString(err);
    }
    return undefined;
  } finally {
    const rowWithNameUsed = { ...row, facilityName: nameUsed };
    await writeToCsv({
      filePath: logsFilePath,
      success: rowSuccess,
      message,
      row: rowWithNameUsed,
    });
  }
}

async function createFacility(
  createPayload: FacilityInternalDetails,
  cxId: string
): Promise<Facility> {
  const url = `${internalUrl}/internal/facility`;
  const response = await axios.put(url, createPayload, {
    params: { cxId },
    headers: {
      "Content-Type": "application/json",
    },
  });
  return response.data;
}

async function writeToCsv({
  filePath,
  success,
  message,
  row,
}: {
  filePath: string;
  success: boolean;
  message: string | undefined;
  row: InputRowFacilityImport;
}): Promise<void> {
  const newRow = {
    npi: row.npi,
    facilityName: row.facilityName.replace(/"/g, '""'),
    type: row.type,
    principalOid: row.principalOid ?? "",
    success: success ? "SUCCESS" : "FAILED",
    reason: success ? "" : (message ?? "").replace(/"/g, '""'),
  };

  const formattedRow =
    [
      newRow.npi,
      `"${newRow.facilityName}"`,
      newRow.type,
      newRow.principalOid,
      newRow.success,
      `"${newRow.reason}"`,
    ].join(",") + "\n";

  await fs.appendFile(filePath, formattedRow, "utf8");
}

function normalizeFacilityName(name: string): string {
  return name.toLowerCase().trim();
}

function facilityNamesMatch(registryName: string | undefined, csvName: string): boolean {
  if (!registryName) {
    return false;
  }

  const normalizedRegistry = normalizeFacilityName(registryName);
  const normalizedCsv = normalizeFacilityName(csvName);

  return normalizedRegistry.includes(normalizedCsv) || normalizedCsv.includes(normalizedRegistry);
}

const program = new Command();

program
  .name("bulk-import-facility")
  .requiredOption("--input-path <inputpath>", "The path to the input csv file")
  .requiredOption("--cx-id <cxId>", "The customer ID for the facilities to be created under.")
  .option(
    "--dryrun",
    "Writes to a local JSON file all the facilities it would of tried to create. Does not upload to S3 or add Facilities to the DB"
  )
  .description(
    "Creates facilities for the customer inputted based on NPIs, Names, Type, principalOid from a a csv stored in S3."
  )
  .showHelpAfterError()
  .version("1.0.0")
  .action(main);

if (require.main === module) {
  program.parse(process.argv);
}
export default program;
