import dayjs from "dayjs";
import { TextOrTextObject } from "./schema";
import { Slot } from "./schema";
import { Name } from "./outbound/xca/process/schema";

export function timestampToHl7v3DateTime(createdTimestamp: string): string {
  return dayjs(createdTimestamp).format("YYYYMMDDHHmmss");
}

export function dateToHl7v3Date(date: string): string {
  return dayjs(date).format("YYYYMMDD");
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

    if (!value) return undefined;
    if (Array.isArray(value)) {
      return String(value[0]);
    }
    return String(value);
  }
  return undefined;
}

export function getNameValue(name: Name | undefined): string | undefined {
  const localizedString = name?.LocalizedString;
  return typeof localizedString === "object" ? localizedString?._value : localizedString;
}
