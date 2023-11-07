import { v4 as uuidv4 } from "uuid";
import { WebhookType } from "../../domain/webhook";
import NotFoundError from "../../errors/not-found";
import { WebhookRequest, WebhookRequestStatus } from "../../models/webhook-request";

export type CreateWebhookRequestCommand = {
  cxId: string;
  type: WebhookType;
  payload: object;
  status?: WebhookRequestStatus;
};

export const createWebhookRequest = async (
  create: CreateWebhookRequestCommand
): Promise<WebhookRequest> => {
  return WebhookRequest.create({
    ...create,
    id: uuidv4(),
    status: create.status ? create.status : "processing",
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
