import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Facility } from "@metriport/api-sdk";
import { FacilityInternalDetails } from "@metriport/core/domain/facility";
import {
  getFacilityByNpiOrFail,
  translateNpiFacilityToMetriportFacility,
} from "@metriport/core/external/npi-registry/npi-registry";
import { errorToString, getEnvVarOrFail, MetriportError, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import axios from "axios";
import { Command } from "commander";
import csvParser from "csv-parser";
import fs from "fs/promises";
import { createReadStream, constants as FS } from "node:fs";
import { access } from "node:fs/promises";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "path";
import { z } from "zod";

/*
 * This script will read NPIs, Names, Type, CqOboOid, CwOboOid from a local csv.
 *
 * Run this script from the package root. Not from src/facility/
 *
 * CqOboOid and CwOboOid are both optional if type is 'non-obo'
 *
 * It outputs the result of processing into runs/import-facility/timestamp with the name inputted and _result appended.
 * - facility-creates.json: is created under runs/import-facility/timestamp it contains the list of facilities that were sent (would have been sent if dryrun) for creation.
 *
 * Format of the .csv file:
 * - first line contains column names
 * - minimum columns: npi,facilityName,facilityType,cqOboOid,cwOboOid
 *
 * Either set the env vars below on the OS or create a .env file in the root folder of this package.
 *
 * Execute this with:
 * $ ts-node src/facility/bulk-import-facility --input-path <inputpath> --cx-id <cxId> --dryrun
 * $ ts-node src/facility/bulk-import-facility --input-path <inputpath> --cx-id <cxId>
 */

const internalUrl = getEnvVarOrFail("API_URL");

interface FacilityImportParams {
  cxId: string;
  inputPath: string;
  dryrun?: boolean;
}

export const InputRowSchema = z.object({
  npi: z.string(),
  facilityName: z.string(),
  facilityType: z.enum(["obo", "non-obo"]),
  cqOboOid: z.string().optional(),
  cwOboOid: z.string().optional(),
});
export type InputRowFacilityImport = z.infer<typeof InputRowSchema>;

const CSV_HEADER =
  ["npi", "facilityName", "facilityType", "cqOboOid", "cwOboOid", "success", "reason"].join(",") +
  "\n";

async function main({ cxId, inputPath, dryrun }: FacilityImportParams) {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const isDryRun = Boolean(dryrun);
  const currentTime = buildDayjs(new Date());
  const outputTimeStamp = currentTime.format("YYYY-MM-DD");
  const name = path.basename(inputPath, path.extname(inputPath));

  console.log(
    `############## STARTING AT: ${currentTime.toISOString()}  ${
      isDryRun ? "[DRY RUN]" : ""
    } ##############`
  );

  const parser = csvParser({
    headers: ["npi", "facilityName", "facilityType", "cqOboOid", "cwOboOid"],
    skipLines: 1,
  });

  const logsFolder = `runs/import-facility/${outputTimeStamp}`;
  const resultFileName = `${name}_result${isDryRun ? "_dryrun" : ""}.csv`;

  const logsFilePath = `${logsFolder}/${resultFileName}`;
  const payloadCreatesFilePath = `${logsFolder}/${name}_facility-creates${
    isDryRun ? "_dryrun" : ""
  }.json`;

  await createCsv(logsFilePath, CSV_HEADER);

  const createdFacilities: FacilityInternalDetails[] = [];

  let success = true;
  let errorMessage: string | undefined;

  const rowPromises: Promise<void>[] = [];

  parser.on("data", async (row: InputRowFacilityImport) => {
    parser.pause();
    const p = (async () => {
      try {
        const npiFacility = await getFacilityByNpiOrFail(row.npi);

        const metriportFacility = translateNpiFacilityToMetriportFacility(npiFacility, row);

        if (!isDryRun) {
          await createFacility(metriportFacility, cxId);
        }
        createdFacilities.push(metriportFacility);
        console.log(`Successfully created facility with npi: ${row.npi}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        success = false;
        if (axios.isAxiosError(err) && err.response?.status === 400) {
          // This is specifically for "Can't Create a new facility with the same NPI as ..."
          const message = err.response.data?.detail ?? err.response.data?.title ?? err.message;
          console.log(message);
          errorMessage = message;
        } else {
          console.log(err);
          const message = errorToString(err);
          errorMessage = message;
        }
      } finally {
        await writeToCsv(logsFilePath, success, errorMessage, row);
        await sleep(60);
        parser.resume();
      }
    })().catch(error => {
      console.log("Unexpected error in row processing:", error);
      parser.resume();
    });
    rowPromises.push(p);
  });

  await new Promise<void>((resolve, reject) => {
    parser.once("end", resolve);
    parser.once("error", reject);
    readFileFromLocal(inputPath, parser).catch(reject);
  });

  await Promise.all(rowPromises);

  await fs.writeFile(payloadCreatesFilePath, JSON.stringify(createdFacilities, null, 2), "utf8");

  console.log(
    `############## FINISHED AT: ${new Date().toISOString()}  ${
      isDryRun ? "[DRY RUN]" : ""
    } ##############`
  );
}

export async function readFileFromLocal(inputPath: string, parser: Writable): Promise<void> {
  const filePath = path.resolve(inputPath);

  try {
    await access(filePath, FS.R_OK);
  } catch {
    throw new MetriportError("File does not exist or is not readable.", undefined, {
      inputPath: filePath,
    });
  }

  await pipeline(createReadStream(filePath), parser);
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

export async function createCsv(filePath: string, csvHeader: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(filePath, csvHeader, "utf8");
}

async function writeToCsv(
  filePath: string,
  success: boolean,
  message: string | undefined,
  originalRow: InputRowFacilityImport
): Promise<void> {
  const rec = {
    npi: originalRow.npi,
    facilityName: originalRow.facilityName.replace(/"/g, '""'),
    facilityType: originalRow.facilityType,
    cqOboOid: originalRow.cqOboOid ?? "",
    cwOboOid: originalRow.cwOboOid ?? "",
    success: success ? "SUCCESS" : "FAILED",
    reason: success ? "" : (message ?? "").replace(/"/g, '""'),
  };

  const line =
    [
      rec.npi,
      `"${rec.facilityName}"`,
      rec.facilityType,
      rec.cqOboOid,
      rec.cwOboOid,
      rec.success,
      `"${rec.reason}"`,
    ].join(",") + "\n";

  await fs.appendFile(filePath, line, "utf8");
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
    "Creates facilities for the customer inputted based on NPIs, Names, Type, CqOboOid, CwOboOid from a a csv stored in S3."
  )
  .showHelpAfterError()
  .version("1.0.0")
  .action(main);

if (require.main === module) {
  program.parse(process.argv);
}
export default program;
