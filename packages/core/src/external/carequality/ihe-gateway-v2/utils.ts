import dayjs from "dayjs";
import { genderMapping } from "../../fhir/patient";

const cidPrefixRegex = /^cid:/;
const tagRegex = /^<|>$/g;

export function normalizeGender(gender: "M" | "F" | undefined): "male" | "female" | undefined {
  if (gender === undefined) {
    return undefined;
  }
  return genderMapping[gender] ?? undefined;
}

export function timestampToSoapBody(createdTimestamp: string): string {
  return dayjs(createdTimestamp).toISOString();
}

export function stripCidPrefix(cid: string): string {
  return cid.replace(cidPrefixRegex, "");
}

export function stripTags(content: string): string {
  return content.replace(tagRegex, "");
}
