import { ConsolidationConversionType, ConsolidatedQuery } from "@metriport/api-sdk";
import { QueryStatus } from "@metriport/core/domain/query-status";
import { WebhookRequest } from "../../../models/webhook-request";

type ConsolidatedWebhookQuery = {
  requestId: string;
  fileUrl?: string;
  status?: QueryStatus;
  conversionType?: ConsolidationConversionType;
  message?: string;
};

export async function getConsolidatedWebhook({
  cxId,
  requestId,
  consolidatedQueries,
}: {
  cxId: string;
  requestId: string;
  consolidatedQueries: ConsolidatedQuery[] | null;
}): Promise<ConsolidatedWebhookQuery> {
  const consolidatedWebhookQuery = consolidatedQueries?.find(
    query => query.requestId === requestId
  );

  if (!consolidatedWebhookQuery) {
    return {
      requestId,
      status: "failed",
      message: "Consolidated webhook query not found",
    };
  }

  if (consolidatedWebhookQuery.status !== "completed") {
    return {
      requestId,
      status: consolidatedWebhookQuery.status,
      message: "Consolidated webhook query is not completed",
    };
  }

  const conversionIsValid =
    consolidatedWebhookQuery.conversionType === "html" ||
    consolidatedWebhookQuery.conversionType === "pdf" ||
    consolidatedWebhookQuery.conversionType === "json";

  if (!conversionIsValid) {
    return {
      requestId,
      conversionType: consolidatedWebhookQuery.conversionType,
      message: "No URL to return for this conversion type",
    };
  }

  const webhookData = await WebhookRequest.findOne({
    where: {
      cxId,
      requestId,
    },
  });

  if (!webhookData) {
    return {
      requestId,
      status: "failed",
      message: "Webhook data not found",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webhookPayload: any = webhookData.payload;

  const url =
    webhookPayload.patients?.[0]?.bundle?.entry?.[0]?.resource?.content?.[0]?.attachment?.url;

  if (!url) {
    return {
      requestId,
      status: "failed",
      message: "No URL found for this webhook",
    };
  }

  return {
    requestId,
    status: consolidatedWebhookQuery.status,
    fileUrl: url,
    conversionType: consolidatedWebhookQuery.conversionType,
  };
}
