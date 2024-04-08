export function normalizeGender(gender: "M" | "F" | undefined): "male" | "female" | undefined {
  if (!gender) return undefined;
  if (gender === "M") {
    return "male";
  } else if (gender === "F") {
    return "female";
  }
  return undefined;
}
