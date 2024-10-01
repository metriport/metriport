import dayjs from "dayjs";
import { TextOrTextObject } from "./schema";
import { Slot } from "./schema";

export function timestampToSoapBody(createdTimestamp: string): string {
  return dayjs(createdTimestamp).toISOString();
}

export function extractText(textOrTextObject: TextOrTextObject): string {
  if (typeof textOrTextObject === "object") {
    return String(textOrTextObject._text);
  }
  return String(textOrTextObject);
}

export function getSlotValue(slot: Slot | undefined): string | undefined {
  if (!slot) {
    return undefined;
  }
  if (typeof slot.ValueList === "object" && slot.ValueList !== undefined) {
    const value = slot.ValueList.Value;
    if (Array.isArray(value)) {
      return String(value[0]);
    }
    return String(value);
  }
  return undefined;
}
