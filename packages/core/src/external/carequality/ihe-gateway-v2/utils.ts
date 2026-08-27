import { buildDayjs } from "@metriport/shared/common/date";
import { Name } from "./outbound/xca/process/schema";
import { Slot, TextOrTextObject } from "./schema";

export function timestampToSoapBody(createdTimestamp: string, format = "YYYYMMDDHHmmss"): string {
  return buildDayjs(createdTimestamp).format(format);
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
