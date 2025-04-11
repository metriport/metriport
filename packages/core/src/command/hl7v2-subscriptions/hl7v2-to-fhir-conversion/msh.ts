import { Hl7Message } from "@medplum/core";
import { MetriportError } from "@metriport/shared";
import { getOptionalValueFromSegment, getSegmentByNameOrFail } from "./shared";

const MSH_9_MESSAGE_TYPE = 9;
const MSH_9_CODE_IDENTIFIER = 1;
const MSH_9_TRIGGER_EVENT_IDENTIFIER = 2;
const MSH_9_STRUCTURE_IDENTIFIER = 3;

export type MessageType = {
  code: string;
  structure: string;
};

export function getMessageTypeOrFail(hl7Message: Hl7Message): MessageType {
  const mshSegment = getSegmentByNameOrFail(hl7Message, "MSH");

  const messageCode = getOptionalValueFromSegment(
    mshSegment,
    MSH_9_MESSAGE_TYPE,
    MSH_9_CODE_IDENTIFIER
  );
  const messageStructure = getOptionalValueFromSegment(
    mshSegment,
    MSH_9_MESSAGE_TYPE,
    MSH_9_STRUCTURE_IDENTIFIER
  );
  if (!messageCode) {
    throw new MetriportError("Message type code not found in MSH segment");
  }

  if (messageStructure) {
    return { code: messageCode, structure: messageStructure };
  }

  const triggerEvent = getOptionalValueFromSegment(
    mshSegment,
    MSH_9_MESSAGE_TYPE,
    MSH_9_TRIGGER_EVENT_IDENTIFIER
  );

  if (!triggerEvent) {
    throw new MetriportError("Message type structure not found in MSH segment");
  }

  return { code: messageCode, structure: `${messageCode}_${triggerEvent}` };
}
