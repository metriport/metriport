import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getEnvVarOrFail, MetriportError } from "@metriport/shared";
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
 * This script will read NPIs from a csv saved in S3.
 *
 * It outputs the result of processing in the same S3 folder with the name inputted and _result appended.
 * - facility-creates.json: contains the list of facilities that would be created (when run w/ dryrun)
 *
 * Format of the .csv file:
 * - first line contains column names
 * - columns can be in any order
 * - minimum columns: firstname,lastname,dob,gender,zip,city,state,address1,address2,phone,email,externalId
 * - it may contain more columns, only those above will be used
 *
 * Either set the env vars below on the OS or create a .env file in the root folder of this package.
 *
 * Execute this with:
 * $ npm run bulk-insert -- --dryrun
 * $ npm run bulk-insert
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
export type InputRow = z.infer<typeof InputRowSchema>;

const S3Utils = getS3UtilsInstance();

async function main({ cxId, name, timestamp, dryrun }: FacilityImportParams) {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's

  const bucket = getEnvVarOrFail("FACILITY_IMPORT_BUCKET");
  const internalUrl = getEnvVarOrFail("INTERNAL_URL");
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

  await createCsv(logsFilePath);

  const createdFacilities: FacilityInternalDetails[] = [];

  let success = true;
  let errorMessage: string | undefined;

  const rowPromises: Promise<void>[] = [];

  parser.on("data", async (row: InputRow) => {
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
          const message = err.response.data?.detail ?? err.response.data?.title ?? err.message;
          console.log(message);
          errorMessage = message;
        } else if (err instanceof MetriportError) {
          const message = `Message: ${err.message} Additional Info: ${err.additionalInfo}`;
          console.log(message);
          errorMessage = message;
        } else if (err instanceof Error) {
          console.log(err.message);
          errorMessage = err.message;
        } else {
          console.log(String(err));
          errorMessage = String(err);
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

  console.log(`Wrote payloads to: ${payloadCreatesFilePath}`);
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

async function createCsv(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const CSV_HEADER =
    ["npi", "facilityName", "facilityType", "cqOboOid", "cwOboOid", "success", "reason"].join(",") +
    "\n";
  await fs.writeFile(filePath, CSV_HEADER, "utf8");
}

async function writeToCsv(
  filePath: string,
  success: boolean,
  message: string | undefined,
  originalRow: InputRow
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
  .requiredOption("--cx-id <cxId>", "The customer ID.")
  .requiredOption(
    "--timestamp <timestamp>",
    `The timestamp (YYYY-MM-DD) of when the file was created.`
  )
  .requiredOption("--name <name>", `The name of the file. Do not add .csv`)
  .option(
    "--dryrun",
    "Writes to a local JSON file all the facilities it would of tried to create. Does not upload to S3 or add Facilities to the DB"
  )
  .description("Creates facilities based on NPIs and additional data from a a csv stored in S3.")
  .showHelpAfterError()
  .version("1.0.0")
  .action(main);

program.parse(process.argv);

export default program;
