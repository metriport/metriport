import dayjs from "dayjs";
import { TextOrTextObject } from "./schema";

export function timestampToSoapBody(createdTimestamp: string): string {
  return dayjs(createdTimestamp).toISOString();
}

export function extractText(textOrTextObject: TextOrTextObject): string {
  if (typeof textOrTextObject === "string") {
    return textOrTextObject;
  }
  return textOrTextObject._text;
}
