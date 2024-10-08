import dayjs from "dayjs";
import { TextOrTextObject } from "./schema";
import { Name } from "./outbound/xca/process/schema";

export function timestampToSoapBody(createdTimestamp: string): string {
  return dayjs(createdTimestamp).toISOString();
}

export function extractText(textOrTextObject: TextOrTextObject): string {
  if (typeof textOrTextObject === "object") {
    return String(textOrTextObject._text);
  }
  return String(textOrTextObject);
}

export function getNameValue(name: Name | undefined): string | undefined {
  const localizedString = name?.LocalizedString;
  return typeof localizedString === "object" ? localizedString?._value : localizedString;
}
