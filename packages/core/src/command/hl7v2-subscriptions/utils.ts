import { MetriportError } from "@metriport/shared";
import { compressUuid } from "./hl7v2-to-fhir-conversion/shared";
import IPCIDR from "ip-cidr";
import { HieConfigDictionary } from "../../external/hl7-notification/hie-config-dictionary";

export function createScrambledId(cxId: string, patientId: string): string {
  const compressedCxId = compressUuid(cxId);
  const compressedPatientId = compressUuid(patientId);
  return `${compressedCxId}_${compressedPatientId}`;
}

/**
 * Lookup the HIE config for a provided IP address.
 * @param hieConfigDictionary The HIE config dictionary.
 * @param ip The IP address to lookup.
 * @returns The HIE config for the given IP address.
 */
export function lookupHieTzEntryForIp(hieConfigDictionary: HieConfigDictionary, ip: string) {
  const hieVpnConfigRows = Object.entries(hieConfigDictionary).flatMap(keepOnlyVpnConfigs);
  const match = hieVpnConfigRows.find(({ cidrBlock }) => isIpInRange(cidrBlock, ip));
  if (!match) {
    throw new MetriportError(`Sender IP not found in any CIDR block`, {
      cause: undefined,
      additionalInfo: { context: "mllp-server.lookupHieTzEntryForIp", ip, hieConfigDictionary },
    });
  }
  return match;
}

function isIpInRange(cidrBlock: string, ip: string): boolean {
  const cidr = new IPCIDR(cidrBlock);
  return cidr.contains(ip);
}

function keepOnlyVpnConfigs([hieName, config]: [string, HieConfigDictionary[string]]) {
  return "cidrBlock" in config
    ? [{ hieName, cidrBlock: config.cidrBlock, timezone: config.timezone }]
    : [];
}
