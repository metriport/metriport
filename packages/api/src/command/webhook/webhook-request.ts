import { limitStringLength, NotFoundError } from "@metriport/shared";
import { v4 as uuidv4 } from "uuid";
import { WebhookRequestStatus, WebhookType } from "../../domain/webhook";
import { WebhookRequest } from "../../models/webhook-request";
import { MAX_VARCHAR_LENGTH } from "../../models/_default";

export type CreateWebhookRequestCommand = {
  cxId: string;
  type: WebhookType;
  payload: object;
  requestId?: string;
  status?: WebhookRequestStatus;
};

export async function createWebhookRequest(
  create: CreateWebhookRequestCommand
): Promise<WebhookRequest> {
  return WebhookRequest.create({
    ...create,
    id: uuidv4(),
    status: create.status ? create.status : "processing",
  });
}

// TODO: 1411 - remove when DAPI is fully discontinued
export type WebhookRequestData = {
  id: string;
  cxId: string;
  type: WebhookType;
  payload: object;
  requestId?: string;
  status: WebhookRequestStatus;
  createdAt: Date;
};

// TODO: 1411 - remove when DAPI is fully discontinued
export function buildWebhookRequestData(create: CreateWebhookRequestCommand): WebhookRequestData {
  return {
    ...create,
    id: uuidv4(),
    type: create.type,
    createdAt: new Date(),
    status: create.status ? create.status : "processing",
  };
}

export type UpdateWebhookRequestCommand = {
  id: string;
  status: WebhookRequestStatus;
  statusDetail?: string;
  requestUrl?: string;
  httpStatus?: number;
  durationMillis?: number;
};

export async function updateWebhookRequest({
  id,
  status,
  statusDetail,
  requestUrl,
  httpStatus,
  durationMillis,
}: UpdateWebhookRequestCommand): Promise<void> {
  const whRequest = await WebhookRequest.findOne({ where: { id } });
  if (!whRequest) throw new NotFoundError(`Could not find webhook request ${id}`);
  const statusDetailParsed = limitStringLength(statusDetail, MAX_VARCHAR_LENGTH);
  const requestUrlParsed = limitStringLength(requestUrl, MAX_VARCHAR_LENGTH);
  await WebhookRequest.update(
    {
      status,
      statusDetail: statusDetailParsed,
      requestUrl: requestUrlParsed,
      httpStatus,
      durationMillis,
    },
    { where: { id } }
  );
}

export async function getAllWebhookRequestByRequestId(
  requestId: string
): Promise<WebhookRequest[]> {
  return WebhookRequest.findAll({ where: { requestId } });
}
