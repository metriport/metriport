import { SearchSetBundle } from "@metriport/shared/medical";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { createFolderName } from "../../../../domain/filename";
import { S3Utils } from "../../../../external/aws/s3";
import { Config } from "../../../../util/config";
import {
  JSON_FILE_EXTENSION,
  JSON_TXT_MIME_TYPE,
  TXT_FILE_EXTENSION,
  TXT_MIME_TYPE,
} from "../../../../util/mime";
import { getConsolidatedPatientData } from "../../consolidated-get";
import {
  SearchConsolidated,
  SearchConsolidatedParams,
  SearchConsolidatedResult,
} from "./search-consolidated";
import { searchLexical } from "./search-lexical";

dayjs.extend(duration);

const resultUrlDuration = dayjs.duration({ minutes: 1 });

const searchFolderName = "searches";

/**
 * Performs a search on a patient's consolidated data with in-memory processing.
 * Still relies on external services to get the consolidated data.
 */
export class SearchConsolidatedDirect implements SearchConsolidated {
  async search({ patient, query }: SearchConsolidatedParams): Promise<SearchConsolidatedResult> {
    const searchResult = query
      ? await searchLexical({ patient, query })
      : await getConsolidatedPatientData({ patient });

    if (!searchResult || !searchResult.entry || searchResult.entry.length < 1) {
      return { resourceCount: 0 };
    }
    const url = await storeSearchResult({
      cxId: patient.cxId,
      patientId: patient.id,
      query,
      result: searchResult,
    });
    return { url, resourceCount: searchResult.entry.length };
  }
}

async function storeSearchResult({
  cxId,
  patientId,
  query,
  result,
}: {
  cxId: string;
  patientId: string;
  query: string | undefined;
  result: SearchSetBundle;
}): Promise<string> {
  const s3 = new S3Utils(Config.getAWSRegion());

  // TODO eng-268 create a dedicated bucket for this
  const bucket = Config.getMedicalDocumentsBucketName();
  const keyPrefix = buildNewS3KeyPrefix(cxId, patientId);
  const resultKey = `${keyPrefix}-result.${JSON_FILE_EXTENSION}`;
  const queryKey = `${keyPrefix}-query.${TXT_FILE_EXTENSION}`;

  const queryAsText = query ?? "<empty>";
  const resultAsText = JSON.stringify(result);

  await Promise.all([
    s3.uploadFile({
      bucket,
      key: resultKey,
      file: Buffer.from(resultAsText, "utf8"),
      contentType: JSON_TXT_MIME_TYPE,
    }),
    s3.uploadFile({
      bucket,
      key: queryKey,
      file: Buffer.from(queryAsText, "utf8"),
      contentType: TXT_MIME_TYPE,
    }),
  ]);

  const url = await s3.getSignedUrl({
    bucketName: bucket,
    fileName: resultKey,
    durationSeconds: resultUrlDuration.asSeconds(),
  });
  return url;
}

function buildNewS3KeyPrefix(cxId: string, patientId: string, date = new Date()): string {
  const s3FolderName = createFolderName(cxId, patientId);
  const keyPrefix = s3FolderName + "/" + searchFolderName + "/" + dayjs(date).toISOString();
  return keyPrefix;
}
