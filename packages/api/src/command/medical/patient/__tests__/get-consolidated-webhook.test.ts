import { v4 as uuidv4 } from "uuid";
import {
  makeConsolidatedQueryProgress,
  makeConsolidatedWebhook,
} from "../__tests__/store-query-cmd";
import { getConsolidatedWebhook } from "../get-consolidated-webhook";
import { WebhookRequest } from "../../../../models/webhook-request";

describe("getConsolidatedWebhook", () => {
  const cxId = uuidv4();

  it("it return webhook url when consolidated query is complete and url available", async () => {
    const requestId = uuidv4();
    const consolidatedQuery = makeConsolidatedQueryProgress({
      requestId: requestId,
      status: "completed",
      startedAt: new Date(),
      conversionType: "pdf",
    });

    const webhook = makeConsolidatedWebhook();
    WebhookRequest.findOne = jest.fn().mockResolvedValueOnce(webhook);

    const result = await getConsolidatedWebhook({
      cxId,
      requestId,
      consolidatedQueries: [consolidatedQuery],
    });

    expect(result).toEqual({
      requestId,
      conversionType: "html",
    });
  });
});
