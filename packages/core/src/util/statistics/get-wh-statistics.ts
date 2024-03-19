import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import z from "zod";
import { executeAsynchronously } from "../concurrency";
import { out } from "../log";
import { initSequelizeForLambda } from "../sequelize";
import { StatisticsProps, getQueryResults, tableNameHeader } from "./shared";

const MAX_NUMBER_OF_PARALLEL_DQ_PROCESSING_REQUESTS = 20;
const WH_TABLE_NAME = "webhook_request";

const webhookResultSchema = z.object({
  cx_id: z.string(),
  status: z.string(),
  type: z.string(),
  payload: z.object({
    patients: z.array(
      z.object({
        status: z.string(),
        documents: z
          .array(
            z.object({
              size: z.number().optional(),
              mimeType: z.string(),
            })
          )
          .optional(),
        filters: z.object({}).optional(),
        patientId: z.string(),
      })
    ),
  }),
});

const webhookResultsSchema = z.array(webhookResultSchema);
type WebhookResult = z.infer<typeof webhookResultSchema>;

type WhStatisticsOutput = {
  numRows: number;
  numSuccesses: number;
  downloads: {
    numDownloads: number;
    numWebhooks: number;
    sentSuccessfully: number;
  };
  conversions: {
    numWebhooks: number;
    sentSuccessfully: number;
  };
  mrSummaries: {
    numWebhooks: number;
    sentSuccessfully: number;
  };
};

/**
 * Returns statistics for WH, including the following:
 * 1) # of WHs
 * 2) # of success responses
 * 3) Break down of WHs by type:
 *   - # of medical.document-download downloads, requests and successes
 *   - # of medical.document-conversion requests and successes
 *   - # of medical.consolidated-data requests and successes
 *
 * @param sqlDBCreds    The SQL database credentials.
 * @param cxId          The CX ID.
 * @param patientId     Optional, the patient ID. If not provided, the statistics will be calculated for all patients of the customer organization.
 * @param dateString    Optional, The date string. If provided, will return the results from the set date until present. If not provided, the statistics will be calculated for the 24 hr period starting at 25 hr ago.
 */
export async function getWhStatistics({
  sqlDBCreds,
  cxId,
  patientIds,
  dateString,
}: StatisticsProps): Promise<WhStatisticsOutput> {
  out("Starting WH statistics calculation...");
  const sequelize = initSequelizeForLambda(sqlDBCreds, false);

  try {
    const baseQuery = `
  SELECT * FROM ${WH_TABLE_NAME} 
  WHERE cx_id=:cxId
  `;
    const whResponse = await getQueryResults({
      sequelize,
      baseQuery,
      cxId,
      dateString,
      patientIds: { ids: patientIds, columnName: "payload->'patients'->0->>'patientId'" },
    });
    const whResults = webhookResultsSchema.parse(whResponse);
    const numRows = whResults.length;

    let totalSuccesses = 0;
    const downloads = {
      numDownloads: 0,
      numWebhooks: 0,
      sentSuccessfully: 0,
    };
    const conversions = {
      numWebhooks: 0,
      sentSuccessfully: 0,
    };
    const mrSummaries = {
      numWebhooks: 0,
      sentSuccessfully: 0,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processWhResult = async (wh: WebhookResult) => {
      const whs = wh.payload;
      if (!whs) return;
      if (wh.status === "success") totalSuccesses++;

      if (wh.type === "medical.document-download") {
        downloads.numWebhooks++;
        for (const patient of whs.patients) {
          downloads.numDownloads += patient.documents ? patient.documents.length : 0;
          if (wh.status === "success") downloads.sentSuccessfully++;
        }
      } else if (wh.type === "medical.document-conversion") {
        conversions.numWebhooks++;
        if (wh.status === "success") conversions.sentSuccessfully++;
      } else if (wh.type === "medical.consolidated-data") {
        mrSummaries.numWebhooks++;
        if (wh.status === "success") mrSummaries.sentSuccessfully++;
      }
    };

    await executeAsynchronously(whResults, async wh => processWhResult(wh), {
      numberOfParallelExecutions: MAX_NUMBER_OF_PARALLEL_DQ_PROCESSING_REQUESTS,
    });

    const results = `${tableNameHeader(
      WH_TABLE_NAME
    )}${numRows} webhook requests with ${totalSuccesses} successes.
    - Downloads: ${JSON.stringify(downloads)}
    - Conversions: ${JSON.stringify(conversions)}
    - Consolidated Data (MR Summary): ${JSON.stringify(mrSummaries)}`;
    console.log(results);

    return {
      numRows: numRows,
      numSuccesses: totalSuccesses,
      downloads,
      conversions,
      mrSummaries,
    };
  } catch (err) {
    console.error(err);
    throw new Error("Error while calculating WH statistics.");
  } finally {
    sequelize.close();
  }
}
