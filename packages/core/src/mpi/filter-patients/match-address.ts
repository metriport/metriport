import { intersectionWith } from "lodash";
import { PatientData } from "../../domain/patient";
import { isFuzzyMatch } from "./utils";
import { normalizeString } from "../normalize-patient";
import { ADDRESS_ABBREVIATIONS, DIRECTION_ABBREVIATIONS } from "../../domain/address";

export function calculateAddressScore(
  metriportPatient: PatientData,
  externalPatient: PatientData
): number {
  let score = 0;

  if (hasAddressMatch(metriportPatient, externalPatient)) {
    return 2;
  }

  const cityMatch =
    intersectionWith(
      metriportPatient.address,
      externalPatient.address,
      (addr1, addr2) => normalizeString(addr1?.city || "") === normalizeString(addr2?.city || "")
    ).length > 0;

  const zipMatch =
    intersectionWith(
      metriportPatient.address,
      externalPatient.address,
      (addr1, addr2) => normalizeString(addr1?.zip || "") === normalizeString(addr2?.zip || "")
    ).length > 0;
  const stateMatch =
    intersectionWith(
      metriportPatient.address,
      externalPatient.address,
      (addr1, addr2) => normalizeString(addr1?.state || "") === normalizeString(addr2?.state || "")
    ).length > 0;

  const addressLine1Match =
    intersectionWith(metriportPatient.address, externalPatient.address, (addr1, addr2) => {
      const addr1Normalized = normalizeAddressString(addr1?.addressLine1 || "");
      const addr2Normalized = normalizeAddressString(addr2?.addressLine1 || "");

      if (addr1Normalized === addr2Normalized) return true;

      return isFuzzyMatch(addr1Normalized, addr2Normalized, 0.7);
    }).length > 0;

  if (cityMatch) score += 0.5;
  if (zipMatch) score += 0.5;
  if (stateMatch) score += 0.5;
  if (addressLine1Match) score += 0.5;

  return score;
}

/**
 * Check if there's an address match between two patients (zip, state, and address line 1 match)
 */
export function hasAddressMatch(
  metriportPatient: PatientData,
  externalPatient: PatientData
): boolean {
  return (
    metriportPatient.address?.some(addr1 =>
      externalPatient.address?.some(addr2 => {
        const zipMatch = normalizeString(addr1?.zip || "") === normalizeString(addr2?.zip || "");
        const stateMatch =
          normalizeString(addr1?.state || "") === normalizeString(addr2?.state || "");
        const addressMatch =
          normalizeAddressString(addr1?.addressLine1 || "") ===
          normalizeAddressString(addr2?.addressLine1 || "");

        return zipMatch && stateMatch && addressMatch;
      })
    ) ?? false
  );
}

function normalizeAddressString(str: string): string {
  if (!str) return "";
  let normalized = str.toLowerCase().replace(/\s+/g, " ");

  Object.entries(ADDRESS_ABBREVIATIONS).forEach(([abbr, full]) => {
    const regex = new RegExp(`\\b${abbr}\\b`, "gi");
    normalized = normalized.replace(regex, full);
  });

  Object.entries(DIRECTION_ABBREVIATIONS).forEach(([dir, full]) => {
    const regex = new RegExp(`\\b${dir}\\b`, "gi");
    normalized = normalized.replace(regex, full);
  });

  return normalized;
}
