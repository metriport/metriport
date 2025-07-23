import * as uuidv7_file from "@metriport/core/util/uuid-v7";
import { WebhookRequestCreate } from "../../../../domain/webhook";
import { WebhookRequest } from "../../../../models/webhook-request";

export const requestId = uuidv7_file.uuidv4();
export const patient = { id: uuidv7_file.uuidv7(), cxId: uuidv7_file.uuidv7() };

export function makeConsolidatedWebhook(params?: Partial<WebhookRequestCreate>): WebhookRequest {
  const webhookRequest = {
    cxId: params?.cxId ?? patient.cxId,
    requestId: params?.requestId ?? requestId,
    type: "medical.consolidated-data",
    payload: params?.payload ?? {},
    status: params?.status ?? "success",
    statusDetail: params?.statusDetail ?? "",
    requestUrl: params?.requestUrl ?? "",
    httpStatus: params?.httpStatus ?? 200,
    durationMillis: params?.durationMillis ?? 0,
  } as WebhookRequest;

  return webhookRequest;
}
