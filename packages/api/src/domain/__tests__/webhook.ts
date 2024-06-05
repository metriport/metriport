import { faker } from "@faker-js/faker";
import { WebhookRequest } from "../webhook";
import { makeBaseDomain } from "./base-domain";
import { WebhookType, WebhookRequestStatus } from "../webhook";

export const makeWebhook = ({
  id,
  webhookType,
  status,
}: {
  id: string;
  webhookType: WebhookType;
  status?: WebhookRequestStatus;
}): WebhookRequest => {
  return {
    ...makeBaseDomain({ id }),
    cxId: faker.string.uuid(),
    requestId: faker.string.uuid(),
    type: webhookType,
    payload: {},
    status,
  };
};
