import { Hl7Segment } from "@medplum/core";
import { MetriportError } from "@metriport/shared";
import { getOptionalValueFromSegment } from "./shared";

const MSH_9_MESSAGE_TYPE = 9;
const MSH_9_CODE_IDENTIFIER = 1;
const MSH_9_TRIGGER_EVENT_IDENTIFIER = 2;
const MSH_9_STRUCTURE_IDENTIFIER = 3;

export type MessageType = {
  code: string;
  structure: string;
};

export function getMessageTypeOrFail(msh: Hl7Segment): MessageType {
  const messageCode = getOptionalValueFromSegment(msh, MSH_9_MESSAGE_TYPE, MSH_9_CODE_IDENTIFIER);
  const messageStructure = getOptionalValueFromSegment(
    msh,
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
    msh,
    MSH_9_MESSAGE_TYPE,
    MSH_9_TRIGGER_EVENT_IDENTIFIER
  );

  if (!triggerEvent) {
    throw new MetriportError("Message type structure not found in MSH segment");
  }

  return { code: messageCode, structure: `${messageCode}_${triggerEvent}` };
}
