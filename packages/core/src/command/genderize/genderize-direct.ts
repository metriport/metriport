import { GenderAtBirth } from "@metriport/shared/domain/gender";
import { RunGenderizeHandler, RunGenderizeRequest } from "./genderize";
import { classify } from "./genderize-client";

const THRESHOLD: number = 0.7;

export class RunGenderizeDirect implements RunGenderizeHandler {
  async execute(request: RunGenderizeRequest): Promise<GenderAtBirth> {
    console.log("Running genderize direct.");
    const name = request.name;

    const normalizedFirstName = this.normalizeFirstName(name);

    const result = await classify(normalizedFirstName);

    return this.getGender(result);
  }

  //Some names are stored as "firstName, middleName, otherName" I.E. : "Bob,GoBob,Robert"
  normalizeFirstName(name: string): string {
    // Normalize unicode + strip quotes + trim
    let s = name
      .normalize("NFKC")
      .replace(/["“”„‟]+/g, "")
      .trim();

    // If there are commas, only keep the first segment
    s = (s.split(",")[0] ?? "").trim();

    // Keep letters, hyphens, apostrophes, and spaces. Drop other junk
    s = s
      .replace(/[^\p{L}\p{M}\s\-’']/gu, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!s) return "";

    // first token or empty
    const [firstRaw = ""] = s.split(/\s+/);
    if (!firstRaw) return "";

    // title-case with hyphen/apostrophe support (no non-null assertions)
    const parts = firstRaw.split(/([\-’'])/g);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p && !/^[-’']$/.test(p)) {
        parts[i] = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
      }
    }
    return parts.join("");
  }

  getGender(result: any): GenderAtBirth {
    console.log("result:", JSON.stringify(result));
    if(result.score < THRESHOLD){
      return "U"; 
    } else if (result.label === "female"){
      return "F";
    } else if (result.label === "male"){
      return "M";
    } else {
      return "U";
    }
  }
}
