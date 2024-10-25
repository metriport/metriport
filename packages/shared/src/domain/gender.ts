import { z } from "zod";

export type GenderAtBirth = "F" | "M" | "O" | "U";

export function normalizeGenderSafe(gender: string): GenderAtBirth | undefined {
  const lowerGender = gender.toLowerCase().trim();
  if (lowerGender === "male" || lowerGender === "m") {
    return "M";
  } else if (lowerGender === "female" || lowerGender === "f") {
    return "F";
  } else if (lowerGender === "other" || lowerGender === "un" || lowerGender === "o") {
    return "O";
  } else if (lowerGender === "unknown" || lowerGender === "unk" || lowerGender === "u") {
    return "U";
  }
  return undefined;
}

export function normalizeGender(gender: string): GenderAtBirth {
  const genderOrUndefined = normalizeGenderSafe(gender);
  if (!genderOrUndefined) throw new Error("Invalid gender");
  return genderOrUndefined;
}

export const genderAtBirthSchema = z
  .string()
  .refine(normalizeGenderSafe, { message: "Invalid gender" })
  .transform(gender => normalizeGender(gender));
