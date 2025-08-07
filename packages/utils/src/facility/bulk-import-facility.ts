import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { errorToString, getEnvVarOrFail, MetriportError } from "@metriport/shared";
import { sleep } from "@metriport/shared";
import { Command } from "commander";
import csvParser from "csv-parser";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import axios from "axios";
import { Facility } from "@metriport/api-sdk";
import { z } from "zod";
import {
  getFacilityByNpiOrFail,
  translateNpiFacilityToFacilityDetails,
} from "@metriport/core/external/npi-registry/npi-registry";
import { getS3UtilsInstance } from "@metriport/core/external/ehr/bundle/bundle-shared";
import fs from "fs/promises";
import { FacilityInternalDetails } from "@metriport/core/domain/npi-facility";
import path from "path";

/*
 * This script will read NPIs, Names, Type, CqOboOid, CwOboOid from a csv saved in S3.
 *
 * Run this script from the package root. Not from src/facility/
 *
 * CqOboOid and CwOboOid are both optional if type is 'non-obo'
 *
 * It outputs the result of processing in the same S3 folder as well as runs/import-facility/timestamp with the name inputted and _result appended.
 * - facility-creates.json: is created under runs/import-facility/timestamp it contains the list of facilities that were sent (would have been sent if dryrun) for creation.
 *
 * Format of the .csv file:
 * - first line contains column names
 * - minimum columns: npi,facilityName,facilityType,cqOboOid,cwOboOid
 *
 * Either set the env vars below on the OS or create a .env file in the root folder of this package.
 *
 * Execute this with:
 * $ ts-node src/facility/bulk-import-facility --cx-id <cxId> --timestamp <timestamp> --name <name> --dryrun
 * $ ts-node src/facility/bulk-import-facility --cx-id <cxId> --timestamp <timestamp> --name <name>
 */

interface FacilityImportParams {
  cxId: string;
  name: string;
  timestamp: string;
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

const S3Utils = getS3UtilsInstance();

const CSV_HEADER =
  ["npi", "facilityName", "facilityType", "cqOboOid", "cwOboOid", "success", "reason"].join(",") +
  "\n";

async function main({ cxId, name, timestamp, dryrun }: FacilityImportParams) {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's

  const bucket = getEnvVarOrFail("FACILITY_IMPORT_BUCKET");
  const internalUrl = getEnvVarOrFail("API_URL");
  const isDryRun = Boolean(dryrun);

  console.log(
    `############## STARTING AT: ${new Date().toISOString()}  ${
      isDryRun ? "[DRY RUN]" : ""
    } ##############`
  );

  const parser = csvParser({
    headers: ["npi", "facilityName", "facilityType", "cqOboOid", "cwOboOid"],
    skipLines: 1,
  });

  const logsFolder = `runs/import-facility/${timestamp}`;
  const resultFileName = `${name}_result${isDryRun ? "_dryrun" : ""}.csv`;
  const keyFolder = `ops/facility-import/${cxId}/${timestamp}`;

  const key = `${keyFolder}/${name}`;
  const logsFilePath = `${logsFolder}/${resultFileName}`;
  const resultKey = `${keyFolder}/${resultFileName}`;
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

        const ourFacility = translateNpiFacilityToFacilityDetails(npiFacility, row);

        if (!isDryRun) {
          await createFacility(ourFacility, internalUrl, cxId);
        }
        createdFacilities.push(ourFacility);
        console.log(`Successfully created facility with npi: ${row.npi}`);
      } catch (err: unknown) {
        success = false;
        if (axios.isAxiosError(err) && err.response?.status === 400) {
          // This is specifically for "Can't Create a new facility with the same NPI as ..."
          const message = err.response.data?.detail ?? err.response.data?.title ?? err.message;
          console.log(message);
          errorMessage = message;
        } else {
          const message = errorToString(err);
          errorMessage = message;
        }
      } finally {
        await writeToCsv(logsFilePath, success, errorMessage, row);
        success = true;
        errorMessage = undefined;
        await sleep(60);
        parser.resume();
      }
    })();
    rowPromises.push(p);
  });

  await new Promise<void>((resolve, reject) => {
    parser.once("end", resolve);
    parser.once("error", reject);
    readFileFromS3(cxId, name, bucket, key, parser).catch(reject);
  });

  await Promise.all(rowPromises);

  if (!isDryRun) {
    await uploadToS3(bucket, resultKey, logsFilePath);
  }
  await fs.writeFile(payloadCreatesFilePath, JSON.stringify(createdFacilities, null, 2), "utf8");

  console.log(
    `############## FINISHED AT: ${new Date().toISOString()}  ${
      isDryRun ? "[DRY RUN]" : ""
    } ##############`
  );
}

async function readFileFromS3(
  cxId: string,
  name: string,
  bucket: string,
  key: string,
  parser: NodeJS.WritableStream
): Promise<void> {
  const fileExists = await S3Utils.fileExists(bucket, `${key}.csv`);
  if (!fileExists) {
    throw new MetriportError(
      "File does not exist. Make sure you inputted the correct cxId and name.",
      undefined,
      { cxId, name, bucket, key }
    );
  }

  const fileBuffer = await S3Utils.downloadFile({ bucket, key: `${key}.csv` });

  const readable = Readable.from([fileBuffer]);

  await pipeline(readable, parser);
}

async function createFacility(
  createPayload: FacilityInternalDetails,
  internalUrl: string,
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

async function uploadToS3(bucket: string, key: string, filePath: string): Promise<void> {
  const fileBuffer = await fs.readFile(filePath);

  await S3Utils.uploadFile({
    bucket,
    key,
    file: fileBuffer,
    contentType: "text/csv",
  });
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
  .requiredOption("--cx-id <cxId>", "The customer ID for the facilities to be created under.")
  .requiredOption(
    "--timestamp <timestamp>",
    `The timestamp (YYYY-MM-DD) of when the file was created.`
  )
  .requiredOption("--name <name>", `The name of the file. Do not add .csv`)
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
