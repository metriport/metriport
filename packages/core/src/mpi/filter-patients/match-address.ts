import { PatientData } from "../../domain/patient";
import { Address } from "../../domain/address";
import { isFuzzyMatch } from "./utils";
import { normalizeString } from "../normalize-patient";

export function calculateAddressScore(
  metriportPatient: PatientData,
  externalPatient: PatientData
): number {
  let score = 0;

  if (hasAddressMatch(metriportPatient, externalPatient)) {
    return 2;
  }

  const cityMatch = metriportPatient.address?.some(addr1 =>
    externalPatient.address?.some(
      addr2 => normalizeString(addr1?.city || "") === normalizeString(addr2?.city || "")
    )
  );
  const zipMatch = metriportPatient.address?.some(addr1 =>
    externalPatient.address?.some(
      addr2 => normalizeString(addr1?.zip || "") === normalizeString(addr2?.zip || "")
    )
  );
  const stateMatch = metriportPatient.address?.some(addr1 =>
    externalPatient.address?.some(
      addr2 => normalizeString(addr1?.state || "") === normalizeString(addr2?.state || "")
    )
  );

  const addressLine1Match = metriportPatient.address?.some(addr1 =>
    externalPatient.address?.some(addr2 => {
      const addr1Normalized = normalizeAddressString(addr1?.addressLine1 || "");
      const addr2Normalized = normalizeAddressString(addr2?.addressLine1 || "");

      if (addr1Normalized === addr2Normalized) return true;

      return isFuzzyMatch(addr1Normalized, addr2Normalized, 0.7);
    })
  );

  if (cityMatch) score += 0.5;
  if (zipMatch) score += 0.5;
  if (stateMatch) score += 0.5;
  if (addressLine1Match) score += 0.5;

  return score;
}

/**
 * Check if there's an address match between two patients (zip, state, and address line 1 match)
 */
function hasAddressMatch(metriportPatient: PatientData, externalPatient: PatientData): boolean {
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

/**
 * Check if two addresses match by comparing all fields
 */
export function isAddressMatch(addr1: Address, addr2: Address): boolean {
  return (
    normalizeString(addr1?.city || "") === normalizeString(addr2?.city || "") &&
    normalizeString(addr1?.state || "") === normalizeString(addr2?.state || "") &&
    normalizeString(addr1?.zip || "") === normalizeString(addr2?.zip || "") &&
    normalizeAddressString(addr1?.addressLine1 || "") ===
      normalizeAddressString(addr2?.addressLine1 || "")
  );
}

function normalizeAddressString(str: string): string {
  if (!str) return "";
  let normalized = str.toLowerCase().replace(/\s+/g, " ");

  const abbreviations: { [key: string]: string } = {
    dr: "drive",
    st: "street",
    ave: "avenue",
    blvd: "boulevard",
    rd: "road",
    ln: "lane",
    ct: "court",
    pl: "place",
    cir: "circle",
    way: "way",
    hwy: "highway",
    pkwy: "parkway",
    sq: "square",
    ter: "terrace",
    apt: "apartment",
    ste: "suite",
    unit: "unit",
    fl: "floor",
    rm: "room",
  };

  const directions: { [key: string]: string } = {
    n: "north",
    s: "south",
    e: "east",
    w: "west",
    ne: "northeast",
    nw: "northwest",
    se: "southeast",
    sw: "southwest",
  };

  Object.entries(abbreviations).forEach(([abbr, full]) => {
    const regex = new RegExp(`\\b${abbr}\\b`, "gi");
    normalized = normalized.replace(regex, full);
  });

  Object.entries(directions).forEach(([dir, full]) => {
    const regex = new RegExp(`\\b${dir}\\b`, "gi");
    normalized = normalized.replace(regex, full);
  });

  return normalized;
}
