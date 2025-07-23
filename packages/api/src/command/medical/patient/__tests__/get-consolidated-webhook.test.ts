import { v4 as uuidv4 } from "uuid";
import { makeConsolidatedQueryProgress } from "./consolidated-query";
import { makeConsolidatedWebhook } from "./consolidated-webhook";
import { getConsolidatedWebhook } from "../get-consolidated-webhook";
import { WebhookRequest } from "../../../../models/webhook-request";

const webhookUrl = "http://example.com";

const successConsolidatedWebhook = {
  patients: [
    {
      bundle: {
        entry: [
          {
            resource: {
              content: [
                {
                  attachment: {
                    url: webhookUrl,
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
};

jest.mock("../../../../models/medical/patient");

beforeAll(() => {
  jest.restoreAllMocks();
});
beforeEach(() => {
  jest.clearAllMocks();
});

describe("getConsolidatedWebhook", () => {
  const cxId = uuidv4();
  const requestId = uuidv4();

  it("it return webhook url when consolidated query is complete and url available", async () => {
    const consolidatedQuery = makeConsolidatedQueryProgress({
      requestId: requestId,
      status: "completed",
      startedAt: new Date(),
      conversionType: "pdf",
    });

    const webhook = makeConsolidatedWebhook({
      cxId,
      requestId,
      payload: successConsolidatedWebhook,
    });

    jest.spyOn(WebhookRequest, "findOne").mockResolvedValue(webhook);

    const result = await getConsolidatedWebhook({
      cxId,
      requestId,
      consolidatedQueries: [consolidatedQuery],
    });

    expect(result).toEqual({
      conversionType: "pdf",
      fileUrl: webhookUrl,
      status: "completed",
      requestId,
    });
  });

  it("it return failed message when consolidated webhook query not found", async () => {
    const result = await getConsolidatedWebhook({
      cxId,
      requestId,
      consolidatedQueries: [],
    });

    expect(result).toEqual({
      requestId,
      status: "failed",
      message: "Consolidated webhook query not found",
    });
  });

  it("it return processing message when consolidated webhook query is not completed", async () => {
    const consolidatedQuery = makeConsolidatedQueryProgress({
      requestId: requestId,
      status: "processing",
      startedAt: new Date(),
      conversionType: "pdf",
    });

    const result = await getConsolidatedWebhook({
      cxId,
      requestId,
      consolidatedQueries: [consolidatedQuery],
    });

    expect(result).toEqual({
      requestId,
      status: "processing",
      message: "Consolidated webhook query is not completed",
    });
  });

  it("it return failed message when webhook data not found", async () => {
    const consolidatedQuery = makeConsolidatedQueryProgress({
      requestId: requestId,
      status: "completed",
      startedAt: new Date(),
      conversionType: "pdf",
    });

    jest.spyOn(WebhookRequest, "findOne").mockResolvedValue(null);

    const result = await getConsolidatedWebhook({
      cxId,
      requestId,
      consolidatedQueries: [consolidatedQuery],
    });

    expect(result).toEqual({
      requestId,
      status: "failed",
      message: "Webhook data not found",
    });
  });

  it("it return failed message when url no found", async () => {
    const consolidatedQuery = makeConsolidatedQueryProgress({
      requestId: requestId,
      status: "completed",
      startedAt: new Date(),
      conversionType: "pdf",
    });

    const webhook = makeConsolidatedWebhook({
      cxId,
      requestId,
      payload: {},
    });

    jest.spyOn(WebhookRequest, "findOne").mockResolvedValue(webhook);

    const result = await getConsolidatedWebhook({
      cxId,
      requestId,
      consolidatedQueries: [consolidatedQuery],
    });

    expect(result).toEqual({
      requestId,
      status: "failed",
      message: "No URL found for this webhook",
    });
  });
});
