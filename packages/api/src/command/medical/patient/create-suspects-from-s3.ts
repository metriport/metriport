import { S3Utils } from "@metriport/core/external/aws/s3";
import { MetriportError, uuidv7 } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import csv from "csv-parser";
import * as stream from "stream";
import { SuspectCreate } from "../../../domain/suspect";
import { SuspectModel } from "../../../models/suspect";
import { Config } from "../../../shared/config";

const MAX_NUMBER_ROWS = 100_000;
const region = Config.getAWSRegion();

/**
 * Fetches a CSV file from S3 and inserts the data into the suspect table.
 *
 * @param cxId - The customer ID.
 * @param key - The S3 object key (CSV file path).
 */
export type CreateSuspectsFromS3Params = {
  cxId: string;
  key: string;
};

/**
 * The CSV is expected to have headers: patientId,suspectGroup,suspectIcd10Code,suspectIcd10ShortDescription,responsibleResources,lastRun
 * Only patientId and suspectGroup are required.
 */
export async function createSuspectsFromS3({
  cxId,
  key,
}: CreateSuspectsFromS3Params): Promise<void> {
  const bucket = Config.getAnalyticsPlatformBucketName();
  if (!bucket) throw new MetriportError("Analytics platform bucket name is not set");
  const s3Client = new S3Utils(region);
  const csvAsString = await s3Client.getFileContentsAsString(bucket, key);
  let numberOfRows = 0;
  const promise = new Promise<{
    headers: string[];
    suspects: SuspectCreate[];
  }>(function (resolve, reject) {
    const suspects: SuspectCreate[] = [];
    const headers: string[] = [];
    const s = new stream.Readable();
    s.push(csvAsString);
    s.push(null);
    s.pipe(
      csv({
        mapHeaders: ({ header }: { header: string }) => {
          return header.replace(/[!@#$%^&*()+=\[\]\\';,./{}|":<>?~_\s]/gi, ""); //eslint-disable-line
        },
      })
    )
      .on("headers", async (parsedHeaders: string[]) => {
        headers.push(...parsedHeaders);
      })
      .on("data", async data => {
        try {
          if (++numberOfRows > MAX_NUMBER_ROWS) {
            throw new MetriportError(`CSV has more rows than max (${MAX_NUMBER_ROWS})`);
          }

          const parsedSuspect = csvRecordToSuspect(data, numberOfRows);
          suspects.push(parsedSuspect);
        } catch (error) {
          reject(error);
        }
      })
      .on("end", async () => {
        return resolve({ suspects, headers });
      })
      .on("error", reject);
  });

  const { suspects } = await promise;

  const suspectsToInsert = suspects.map((s: SuspectCreate) => ({
    id: uuidv7(),
    cxId,
    patientId: s.patientId,
    suspectGroup: s.suspectGroup,
    suspectIcd10Code: s.suspectIcd10Code,
    suspectIcd10ShortDescription: s.suspectIcd10ShortDescription,
    responsibleResources: s.responsibleResources,
    lastRun: s.lastRun,
  }));

  await SuspectModel.bulkCreate(suspectsToInsert, {
    ignoreDuplicates: false,
    returning: false,
  });
}

function csvRecordToSuspect(data: Record<string, string>, rowNumber: number): SuspectCreate {
  const cxId = data.CXID;
  const patientId = data.PATIENTID;
  const suspectGroup = data.SUSPECTGROUP;
  const suspectIcd10Code = data.SUSPECTICD10CODE;
  const suspectIcd10ShortDescription = data.SUSPECTICD10SHORTDESCRIPTION;
  const responsibleResources = JSON.parse(data.RESPONSIBLERESOURCES);
  const lastRun = data.LASTRUN;

  if (
    !cxId ||
    !patientId ||
    !suspectGroup ||
    !suspectIcd10Code ||
    !suspectIcd10ShortDescription ||
    !responsibleResources ||
    !lastRun
  ) {
    throw new MetriportError(
      `Missing required fields at row ${rowNumber}: patientId or suspectGroup`
    );
  }

  const lastRunDate = buildDayjs(lastRun).toDate();

  return {
    cxId,
    patientId,
    suspectGroup,
    suspectIcd10Code,
    suspectIcd10ShortDescription,
    responsibleResources,
    lastRun: lastRunDate,
  };
}
