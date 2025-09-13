import { buildDayjs } from "@metriport/shared/common/date";
import { WebhookRequest } from "@metriport/shared/medical";
import { validate as validateUuid } from "uuid";

export function checkWebhookRequestMeta(
  whRequest: WebhookRequest | undefined,
  type: WebhookRequest["meta"]["type"]
): void {
  expect(whRequest).toBeTruthy();
  if (!whRequest) throw new Error("Missing WH request");
  expect(whRequest.meta).toBeTruthy();
  expect(whRequest.meta).toEqual(
    expect.objectContaining({
      type,
      messageId: expect.anything(),
      when: expect.anything(),
    })
  );
  expect(validateUuid(whRequest.meta.messageId)).toBeTrue();
  const expectedRefDate = buildDayjs();
  const expectedMminDate = expectedRefDate.subtract(1, "minute").toDate();
  const expectedMaxDate = buildDayjs().add(1, "minute").toDate();
  const receivedDate = buildDayjs(whRequest.meta.when).toDate();
  expect(receivedDate).toBeAfterOrEqualTo(expectedMminDate);
  expect(receivedDate).toBeBeforeOrEqualTo(expectedMaxDate);
  expect(whRequest.meta).not.toEqual(
    expect.objectContaining({
      data: expect.toBeFalsy,
    })
  );
}
