import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Facility } from "@metriport/api-sdk";
import { FacilityInternalDetails, FacilityType } from "@metriport/core/domain/facility";
import { errorToString, getEnvVarOrFail, sleep, USStateForAddress } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import axios from "axios";
import { Command } from "commander";
import csvParser from "csv-parser";
import dayjs, { duration } from "dayjs";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { endScript, startScript } from "../utils";
import { createCsv, getInternalFacilityByNpi, readFileFromLocal } from "./utils";

dayjs.extend(duration);

/**
 * Bulk updates facilities.
 *
 * Reads facilities in bulk from a CSV file containing NPIs, type, and principalOid.
 * This script will get a facility by the NPI, then update the facility with the new name, type, and principalOid.
 * Updates the facilities in the internal API, CareQuality, and CommonWell.
 *
 * Outputs the result of processing into runs/update-facility/timestamp with the name inputted and _result appended.
 *
 * Set the variables below to configure the script.
 * Ask the team for approval before running.
 *
 * Usage:
 * $ ts-node src/facility/bulk-update-facility --input-path <inputpath> --cx-id <cxId> --dryrun
 */

const internalUrl = getEnvVarOrFail("API_URL");
const waitTimeBetweenChecks = dayjs.duration(1, "seconds");

interface FacilityUpdateParams {
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
export type InputRowFacilityUpdate = z.infer<typeof InputRowSchema>;

const CSV_HEADER =
  ["npi", "facilityName", "type", "principalOid", "success", "reason"].join(",") + "\n";

async function main({ cxId, inputPath, dryrun }: FacilityUpdateParams) {
  const isDryRun = Boolean(dryrun);
  const currentTime = buildDayjs();
  const outputTimeStamp = currentTime.toISOString();
  const name = path.basename(inputPath, path.extname(inputPath));

  const startedAt = await startScript({
    nameOfScript: "bulk-update-facility",
    dryRun: isDryRun,
    optionalParams: {
      cxId,
      internalUrl,
    },
  });

  const logsFolder = `runs/update-facility/${outputTimeStamp}`;
  const resultFileName = `${name}_result${isDryRun ? "_dryrun" : ""}.csv`;

  const logsFilePath = `${logsFolder}/${resultFileName}`;
  const payloadUpdatesFilePath = `${logsFolder}/${name}_facility-updates${
    isDryRun ? "_dryrun" : ""
  }.json`;

  await createCsv(logsFilePath, CSV_HEADER);

  const rows = await readCsvRows(inputPath);
  const updatedFacilities: FacilityInternalDetails[] = [];

  for (const row of rows) {
    const facility = await processRow(row, cxId, isDryRun, logsFilePath);
    if (facility) {
      updatedFacilities.push(facility);
    }
    await sleep(waitTimeBetweenChecks.asMilliseconds());
  }
  console.log(`Updated ${updatedFacilities.length} facilities`);

  console.log(`JSON of the facilities that would have been updated: ${payloadUpdatesFilePath}`);
  console.log(`CSV of the results: ${logsFilePath}`);
  await fs.writeFile(payloadUpdatesFilePath, JSON.stringify(updatedFacilities, null, 2), "utf8");

  await endScript({
    nameOfScript: "bulk-update-facility",
    startedAt,
  });
}

async function readCsvRows(inputPath: string): Promise<InputRowFacilityUpdate[]> {
  const rows: InputRowFacilityUpdate[] = [];
  const parser = csvParser({
    headers: ["npi", "facilityName", "type", "principalOid"],
    skipLines: 1,
  });

  await new Promise<void>((resolve, reject) => {
    parser.on("data", (row: InputRowFacilityUpdate) => {
      rows.push(row);
    });
    parser.once("end", resolve);
    parser.once("error", reject);
    readFileFromLocal(inputPath, parser).catch(reject);
  });

  return rows;
}

async function processRow(
  row: InputRowFacilityUpdate,
  cxId: string,
  isDryRun: boolean,
  logsFilePath: string
): Promise<FacilityInternalDetails | undefined> {
  let rowSuccess = true;
  let message: string | undefined = undefined;

  try {
    const existingFacility = await getInternalFacilityByNpi(cxId, row.npi);
    if (!existingFacility) {
      throw new Error(`Facility with NPI ${row.npi} not found for customer ${cxId}`);
    }

    const updatePayload: FacilityInternalDetails = {
      id: existingFacility.id,
      nameInMetriport: existingFacility.name,
      npi: existingFacility.npi,
      tin: existingFacility.tin,
      addressLine1: existingFacility.address.addressLine1,
      addressLine2: existingFacility.address.addressLine2,
      city: existingFacility.address.city,
      state: existingFacility.address.state as USStateForAddress,
      zip: existingFacility.address.zip,
      country: existingFacility.address.country as "USA",
      cqApproved: existingFacility.cqApproved,
      cqActive: existingFacility.cqActive,
      cwApproved: existingFacility.cwApproved,
      cwActive: existingFacility.cwActive,
      type: row.type as FacilityType,
      principalOid: row.principalOid,
    };

    if (!isDryRun) {
      await updateFacility(updatePayload, cxId);
    }
    console.log(
      `${isDryRun ? "Would have updated" : "Successfully updated"} facility with npi: ${row.npi}`
    );
    return updatePayload;
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
    await writeToCsv(logsFilePath, rowSuccess, message, row);
  }
}

async function updateFacility(
  updatePayload: FacilityInternalDetails,
  cxId: string
): Promise<Facility> {
  const url = `${internalUrl}/internal/facility`;
  const response = await axios.put(url, updatePayload, {
    params: { cxId },
    headers: {
      "Content-Type": "application/json",
    },
  });
  return response.data;
}

async function writeToCsv(
  filePath: string,
  success: boolean,
  message: string | undefined,
  originalRow: InputRowFacilityUpdate
): Promise<void> {
  const row = {
    npi: originalRow.npi,
    facilityName: originalRow.facilityName,
    type: originalRow.type,
    principalOid: originalRow.principalOid ?? "",
    success: success ? "SUCCESS" : "FAILED",
    reason: success ? "" : (message ?? "").replace(/"/g, '""'),
  };

  const line =
    [row.npi, row.facilityName, row.type, row.principalOid, row.success, `"${row.reason}"`].join(
      ","
    ) + "\n";

  await fs.appendFile(filePath, line, "utf8");
}

const program = new Command();

program
  .name("bulk-update-facility")
  .requiredOption("--input-path <inputpath>", "The path to the input csv file")
  .requiredOption("--cx-id <cxId>", "The customer ID for the facilities to be updated.")
  .option(
    "--dryrun",
    "Validates the CSV and checks that facilities exist. Does not update facilities."
  )
  .description(
    "Updates existing facilities for the customer based on NPIs, Type, PrincipalOid from a csv."
  )
  .showHelpAfterError()
  .version("1.0.0")
  .action(main);

if (require.main === module) {
  program.parse(process.argv);
}
export default program;
