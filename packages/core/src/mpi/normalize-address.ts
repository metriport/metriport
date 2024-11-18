import { stripNonNumericChars } from "@metriport/shared";
import { Address } from "@medplum/fhirtypes";

export function normalizeAddress({ line, city, state, postalCode, country }: Address): Address {
  return {
    line:
      line
        ?.filter(l => Boolean(l))
        .map(l => {
          return l
            .toString()
            .trim()
            .toLowerCase()
            .replace(/street/g, "st")
            .replace(/drive/g, "dr")
            .replace(/road/g, "rd")
            .replace(/avenue/g, "ave")
            .replace(/-/g, "");
        }) ?? [],
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
        .replace(/united/g, "usa")
        .slice(0, 3) ?? "usa",
  };
}
