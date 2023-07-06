import { WebhookRequest } from "../../models/webhook-request";

export const countFailedAndProcessingRequests = async (
  cxId: string
): Promise<{ processing: number; failure: number }> => {
  const [processing, failure] = await Promise.allSettled([
    WebhookRequest.count({
      where: { cxId, status: ["processing"] },
    }),
    WebhookRequest.count({
      where: { cxId, status: ["failure"] },
    }),
  ]);
  return {
    processing: processing.status === "fulfilled" ? processing.value : -1,
    failure: failure.status === "fulfilled" ? failure.value : -1,
  };
};
