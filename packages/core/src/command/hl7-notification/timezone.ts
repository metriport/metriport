import { Hl7Message } from "@medplum/core";
import { MetriportError } from "@metriport/shared/dist/error/metriport-error";
import { normalizeState, stateToTimezone } from "@metriport/shared/domain/address/state";

const ZFA_STATE_INDEX = 4;

function getTimezoneFromState(state: string): string {
  const stateEnum = normalizeState(state);
  return stateToTimezone[stateEnum];
}

export function getBambooTimezone(hl7Message: Hl7Message): string {
  const customZfaSegment = hl7Message.getSegment("ZFA");
  if (!customZfaSegment) {
    throw new MetriportError("Custom ZFA segment was not found in a bamboo hl7 message!");
  }

  const customZfaField = customZfaSegment.getField(ZFA_STATE_INDEX);
  if (!customZfaField) {
    throw new MetriportError(
      "Custom ZFA.4 field was not found in a bamboo hl7 message!",
      undefined,
      {
        ZFASegment: customZfaSegment.toString(),
      }
    );
  }
  const timezone = getTimezoneFromState(customZfaField.toString());
  return timezone;
}
