import dayjs from "dayjs";
import { GenderAtBirth } from "../../../domain/patient";
import { mapGenderAtBirthToFhir } from "../../fhir/patient";
import { TextOrTextObject } from "./outbound/schema";

export function normalizeGender(
  gender: GenderAtBirth | undefined
): "male" | "female" | "unknown" | undefined {
  if (gender === undefined) {
    return undefined;
  }
  const mappedGender = mapGenderAtBirthToFhir(gender);
  if (mappedGender === "other") {
    return undefined;
  }
  return mappedGender;
}

export function timestampToSoapBody(createdTimestamp: string): string {
  return dayjs(createdTimestamp).toISOString();
}

export function extractText(textOrTextObject: TextOrTextObject): string {
  if (typeof textOrTextObject === "string") {
    return textOrTextObject;
  }
  return textOrTextObject._text;
}
