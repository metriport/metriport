import { v4 as uuidv4 } from "uuid";
import NotFoundError from "../../errors/not-found";
import { WebhookRequest, WebhookRequestStatus } from "../../models/webhook-request";
import { DAPIWebhookType } from "./devices";
import { MAPIWebhookType } from "../medical/document/document-webhook";

export type CreateWebhookRequestCommand = {
  cxId: string;
  type: DAPIWebhookType | MAPIWebhookType;
  payload: unknown;
};

export const createWebhookRequest = async (
  create: CreateWebhookRequestCommand
): Promise<WebhookRequest> => {
  return WebhookRequest.create({
    ...create,
    id: uuidv4(),
    status: "processing",
  });
};

export type UpdateWebhookLogStatusCommand = {
  id: string;
  status: WebhookRequestStatus;
};

export const updateWebhookRequestStatus = async ({
  id,
  status,
}: UpdateWebhookLogStatusCommand): Promise<void> => {
  const log = await WebhookRequest.findOne({ where: { id } });
  if (!log) throw new NotFoundError(`Could not find webhook requst ${id}`);
  await WebhookRequest.update({ status }, { where: { id } });
};
