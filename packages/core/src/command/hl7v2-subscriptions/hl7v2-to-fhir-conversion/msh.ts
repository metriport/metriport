import { Hl7Message } from "@medplum/core";
import { MetriportError } from "@metriport/shared";
import {
  formatDateToHl7,
  getOptionalValueFromMessage,
  getOptionalValueFromSegment,
  getSegmentByNameOrFail,
} from "./shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";

const MSH_9_MESSAGE_TYPE = 9;

export type Hl7MessageType = {
  messageCode: string;
  triggerEvent: string;
};

export function getHl7MessageTypeOrFail(hl7Message: Hl7Message): Hl7MessageType {
  const mshSegment = getSegmentByNameOrFail(hl7Message, "MSH");
  const messageType = getOptionalValueFromSegment(mshSegment, MSH_9_MESSAGE_TYPE, 1);
  const triggerEvent = getOptionalValueFromSegment(mshSegment, MSH_9_MESSAGE_TYPE, 2);
  const messageStructure = getOptionalValueFromSegment(mshSegment, MSH_9_MESSAGE_TYPE, 3);

  if (!messageType) {
    throw new MetriportError("Message type not found in MSH segment");
  }

  const derivedTriggerEvent = triggerEvent ?? messageStructure?.split("_")[1];

  if (!derivedTriggerEvent) {
    throw new MetriportError("Trigger event not found in MSH segment");
  }

  return { messageCode: messageType, triggerEvent: derivedTriggerEvent };
}

export function getMessageDatetime(msg: Hl7Message): string | undefined {
  return getOptionalValueFromMessage(msg, "MSH", 7, 1);
}

export function getSendingApplication(msg: Hl7Message): string | undefined {
  return getOptionalValueFromMessage(msg, "MSH", 3, 1);
}

export function getOrCreateMessageDatetime(msg: Hl7Message): string {
  return getMessageDatetime(msg) ?? formatDateToHl7(new Date());
}

export function getMessageUniqueIdentifier(msg: Hl7Message): string {
  return getOptionalValueFromMessage(msg, "MSH", 10, 1) ?? createUuidFromText(msg.toString());
}
