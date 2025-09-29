import { Hl7Message } from "@medplum/core";
import { MetriportError } from "@metriport/shared";
import { normalizeState, stateToTimezone } from "@metriport/shared/domain/address/state";

const ZFA_ADDRESS_INDEX = 4; // Field (1 indexed)
const ZFA_STATE_INDEX = 4; // Component (1 indexed)

const PV1_SERVICING_FACILITY_INDEX = 39; // Field (1 indexed)
const PV1_SERVICING_FACILITY_STATE_INDEX = 7; // Component (1 indexed)

function getTimezoneFromState(state: string): string {
  const stateEnum = normalizeState(state);
  return stateToTimezone[stateEnum];
}

export function getKonzaTimezone(hl7Message: Hl7Message): string {
  const pv1Segment = hl7Message.getSegment("PV1");
  if (!pv1Segment) {
    throw new MetriportError("PV1 segment was not found in a Konza hl7 message!");
  }

  const servicingFacility = pv1Segment.getField(PV1_SERVICING_FACILITY_INDEX);
  if (!servicingFacility) {
    throw new MetriportError("Servicing facility was not found in a Konza hl7 message!");
  }

  const state = servicingFacility.getComponent(PV1_SERVICING_FACILITY_STATE_INDEX);
  if (!state) {
    throw new MetriportError(
      "State was not found in the servicing facility of the Konza hl7 message!",
      undefined,
      {
        servicingFacility: servicingFacility.toString(),
      }
    );
  }

  const timezone = getTimezoneFromState(state);
  return timezone;
}

export function getBambooTimezone(hl7Message: Hl7Message): string {
  const customZfaSegment = hl7Message.getSegment("ZFA");
  if (!customZfaSegment) {
    throw new MetriportError("Custom ZFA segment was not found in a bamboo hl7 message!");
  }

  const customZfaAddress = customZfaSegment.getField(ZFA_ADDRESS_INDEX);
  if (!customZfaAddress) {
    throw new MetriportError(
      "Custom ZFA.4 field was not found in a bamboo hl7 message!",
      undefined,
      {
        ZFASegment: customZfaSegment.toString(),
      }
    );
  }

  const state = customZfaAddress.getComponent(ZFA_STATE_INDEX);

  if (!state) {
    throw new MetriportError(
      "State was not found in the custom ZFA.4 field of the bamboo hl7 message!",
      undefined,
      {
        ZFASegment: customZfaAddress.toString(),
        state,
      }
    );
  }
  const timezone = getTimezoneFromState(state);
  return timezone;
}
