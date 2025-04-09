import { Hl7Segment } from "@medplum/core";
import { MetriportError } from "@metriport/shared";

const MSH_9_MESSAGE_TYPE = 9;
const MSH_9_CODE_IDENTIFIER = 1;
const MSH_9_STRUCTURE_IDENTIFIER = 3;

export type MessageType = {
  code: string;
  structure: string;
};

export function getMessageTypeOrFail(msh: Hl7Segment): MessageType {
  const messageCode = msh.getComponent(MSH_9_MESSAGE_TYPE, MSH_9_CODE_IDENTIFIER);
  const messageStructure = msh.getComponent(MSH_9_MESSAGE_TYPE, MSH_9_STRUCTURE_IDENTIFIER);
  if (!messageCode || !messageStructure) {
    throw new MetriportError("Message type / structure not found in MSH segment");
  }
  return { code: messageCode, structure: messageStructure };
}
