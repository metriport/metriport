import { stripNonNumericChars } from "@metriport/shared";
import { Address } from "@medplum/fhirtypes";

export function normalizeAddress({ line, city, state, postalCode, country }: Address): Address {
  return {
    line: normalizeAddressLines(line),
    city: city?.trim().toLowerCase().replace(/-/g, "") ?? "",
    state: state?.trim().toLowerCase().slice(0, 2) ?? "",
    postalCode: stripNonNumericChars(postalCode ?? "")
      .trim()
      .slice(0, 5),
    country:
      country
        ?.trim()
        .toLowerCase()
        .replace(/us/g, "usa")
        .replace(/united states/g, "usa")
        .replace(/united/g, "usa")
        .slice(0, 3) ?? "usa",
  };
}

export function normalizeAddressLines(lines: string[] | undefined): string[] {
  return (
    lines
      ?.filter(l => l !== undefined && l !== null)
      .map(String)
      .filter(l => l !== "")
      .map(l => {
        return l
          .trim()
          .toLowerCase()
          .replace(/street/g, "st")
          .replace(/drive/g, "dr")
          .replace(/road/g, "rd")
          .replace(/avenue/g, "ave")
          .replace(/-/g, "");
      }) ?? []
  );
}
