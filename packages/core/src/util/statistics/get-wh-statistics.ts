import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { QueryTypes } from "sequelize";
import z from "zod";
import { executeAsynchronously } from "../concurrency";
import { initSequelizeForLambda } from "../sequelize";
import { QueryReplacements, getYesterdaysTimeFrame } from "./shared";

const MAX_NUMBER_OF_PARALLEL_DQ_PROCESSING_REQUESTS = 20;

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
 * @param dateString    Optional, The date string. If not provided, the statistics will be calculated for the 24 hr period starting at 25 hr ago.
 */
export async function getWhStatistics(
  sqlDBCreds: string,
  cxId: string,
  patientId?: string,
  dateString?: string
): Promise<string> {
  console.log("Starting WH statistics calculation...");
  const sequelize = initSequelizeForLambda(sqlDBCreds, false);

  let query = `
  SELECT * FROM webhook_request 
  WHERE cx_id=:cxId
  `;

  const replacements: QueryReplacements = {
    cxId,
  };

  if (dateString) {
    query += ` and created_at>:dateString`;
    replacements.dateString = dateString;
  } else {
    const [yesterday, today] = getYesterdaysTimeFrame();
    query += ` and created_at between :yesterday and :today`;
    if (today && yesterday) {
      replacements.yesterday = yesterday;
      replacements.today = today;
    }
  }

  if (patientId) {
    query += ` and payload->'patients'->0->>'patientId'=:patientId`;
    replacements.patientId = patientId;
  }

  query += " limit 20;";

  try {
    const whResultsResponse = await sequelize.query(query, {
      replacements: replacements,
      type: QueryTypes.SELECT,
    });
    const whResults = webhookResultsSchema.parse(whResultsResponse);

    const numberOfRows = whResults.length;

    let totalSuccesses = 0;
    const downloads = {
      number: 0,
      numberOfWebhooks: 0,
      sentSuccessfully: 0,
    };
    const conversions = {
      numberOfWebhooks: 0,
      sentSuccessfully: 0,
    };
    const mrSummaries = {
      numberOfWebhooks: 0,
      sentSuccessfully: 0,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processWhResult = async (wh: WebhookResult) => {
      const whs = wh.payload;
      if (!whs) return;
      if (wh.status === "success") totalSuccesses++;

      if (wh.type === "medical.document-download") {
        downloads.numberOfWebhooks++;
        for (const patient of whs.patients) {
          downloads.number += patient.documents ? patient.documents.length : 0;
          if (wh.status === "success") downloads.sentSuccessfully++;
        }
      } else if (wh.type === "medical.document-conversion") {
        conversions.numberOfWebhooks++;
        if (wh.status === "success") conversions.sentSuccessfully++;
      } else if (wh.type === "medical.consolidated-data") {
        mrSummaries.numberOfWebhooks++;
        if (wh.status === "success") mrSummaries.sentSuccessfully++;
      }
    };

    await executeAsynchronously(whResults, async wh => processWhResult(wh), {
      numberOfParallelExecutions: MAX_NUMBER_OF_PARALLEL_DQ_PROCESSING_REQUESTS,
    });

    return `${numberOfRows} webhook requests with ${totalSuccesses} successes.
    - Downloads: ${JSON.stringify(downloads)}
    - Conversions: ${JSON.stringify(conversions)}
    - Consolidated Data (MR Summary): ${JSON.stringify(mrSummaries)}`;
  } catch (err) {
    console.error(err);
    throw new Error("Error while calculating WH statistics.");
  } finally {
    sequelize.close();
  }
}
