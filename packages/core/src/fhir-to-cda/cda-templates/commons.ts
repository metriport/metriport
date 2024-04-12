import {
  Address,
  CodeableConcept,
  Coding,
  ContactPoint,
  Identifier,
  Organization,
} from "@medplum/fhirtypes";
import { normalizeOid } from "@metriport/shared";
import {
  assigningAuthorityNameAttribute,
  extensionAttribute,
  inlineTextAttribute,
  namespaceXsiAttribute,
  namespaceXsiValue,
  nullFlavorAttribute,
  placeholderOrgOid,
  rootAttribute,
  useAttribute,
  valueAttribute,
  xsiTypeAttribute,
} from "./constants";
import {
  CDAAddress,
  CDACodeCE,
  CDACodeCV,
  CDAInstanceIdentifier,
  CDAOrganization,
  CDATelecom,
  CDAValueST,
  Entry,
  EntryObject,
} from "./types";

const CODING_MAP = new Map<string, string>();
CODING_MAP.set("http://loinc.org", "2.16.840.1.113883.6.1");
CODING_MAP.set("http://snomed.info/sct", "2.16.840.1.113883.6.96");
CODING_MAP.set("http://www.nlm.nih.gov/research/umls/rxnorm", "2.16.840.1.113883.6.88");
CODING_MAP.set("http://www.ama-assn.org/go/cpt", "2.16.840.1.113883.6.12");
CODING_MAP.set("http://fdasis.nlm.nih.gov", "2.16.840.1.113883.4.9");

export const TIMESTAMP_CLEANUP_REGEX = /-|T|:|\.\d+Z$/g;
export function withoutNullFlavorObject(value: string | undefined, key: string): EntryObject {
  if (value === undefined) {
    return {};
  } else {
    return { [key]: value };
  }
}

export function withoutNullFlavorString(value: string | undefined): Entry {
  if (value === undefined) {
    return {};
  } else {
    return value;
  }
}

export function withNullFlavor(value: string | undefined, key: string): Entry {
  if (value === undefined) {
    return { [nullFlavorAttribute]: "UNK" };
  } else {
    return { [key]: value };
  }
}

// see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-CE.html for CE type
export function buildCodeCE({
  code,
  codeSystem,
  codeSystemName,
  displayName,
}: {
  code?: string | undefined;
  codeSystem?: string | undefined;
  codeSystemName?: string | undefined;
  displayName?: string | undefined;
}): CDACodeCE {
  const codeObject: CDACodeCE = {};
  if (code) codeObject["@_code"] = code;
  if (codeSystem) codeObject["@_codeSystem"] = codeSystem;
  if (codeSystemName) codeObject["@_codeSystemName"] = codeSystemName;
  if (displayName) codeObject["@_displayName"] = displayName;

  return codeObject;
}

// see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-CV.html for CV type
export function buildCodeCVFromCodeableConcept(
  codeableConcept: CodeableConcept | undefined
): CDACodeCV | Entry {
  if (!codeableConcept) {
    return withoutNullFlavorString(codeableConcept);
  }

  const primaryCodingRaw = codeableConcept.coding?.[0];
  const primaryCoding = cleanUpCoding(primaryCodingRaw);
  const baseCE = primaryCoding
    ? buildCodeCE({
        code: primaryCoding.code,
        codeSystem: primaryCoding.system,
        codeSystemName: undefined,
        displayName: primaryCoding.display,
      })
    : {};

  const translations = (codeableConcept.coding?.slice(1) || []).map(coding =>
    buildCodeCE({
      code: coding.code,
      codeSystem: mapCodingSystem(coding.system),
      codeSystemName: undefined,
      displayName: coding.display,
    })
  );

  const codeCV: CDACodeCV = {
    ...baseCE,
    originalText: codeableConcept.text,
    translation: translations?.length ? translations : undefined,
  };

  return codeCV;
}

export function buildInstanceIdentifier({
  root,
  extension,
  assigningAuthorityName,
}: {
  root?: string | undefined;
  extension?: string | undefined;
  assigningAuthorityName?: string | undefined;
}): CDAInstanceIdentifier {
  const identifier: CDAInstanceIdentifier = {};
  if (root) identifier[rootAttribute] = root;
  if (extension) identifier[extensionAttribute] = extension;
  if (assigningAuthorityName) identifier[assigningAuthorityNameAttribute] = assigningAuthorityName;

  return identifier;
}

export function buildInstanceIdentifiersFromIdentifier(
  identifiers?: Identifier | Identifier[] | undefined
): CDAInstanceIdentifier[] | Entry {
  if (!identifiers) {
    return withNullFlavor(undefined, rootAttribute);
  }

  const identifiersArray = Array.isArray(identifiers)
    ? identifiers
    : identifiers
    ? [identifiers]
    : [];
  return identifiersArray.map(identifier =>
    buildInstanceIdentifier({
      root: placeholderOrgOid,
      extension: identifier.value,
      assigningAuthorityName: identifier.assigner?.display,
    })
  );
}

export function buildTelecom(telecoms: ContactPoint[] | undefined): CDATelecom[] {
  if (!telecoms) {
    return [];
  }
  return telecoms.map(telecom => {
    const telecomUse = mapTelecomUse(telecom.use);
    return {
      ...withoutNullFlavorObject(telecomUse, useAttribute),
      ...withoutNullFlavorObject(telecom.value, valueAttribute),
    };
  });
}

export function buildAddress(address?: Address[]): CDAAddress[] | undefined {
  return address?.map(addr => {
    const addrUse = mapAddressUse(addr.use);
    return {
      ...withoutNullFlavorObject(addrUse, useAttribute),
      streetAddressLine: withoutNullFlavorString(addr.line?.join(" ")),
      city: withoutNullFlavorString(addr.city),
      state: withoutNullFlavorString(addr.state),
      postalCode: withoutNullFlavorString(addr.postalCode),
      country: withoutNullFlavorString(addr.country),
      useablePeriod: {
        low: withoutNullFlavorObject(addr.period?.start, valueAttribute),
        high: withoutNullFlavorObject(addr.period?.end, valueAttribute),
      },
    };
  }); // Using only first address
}

export function buildRepresentedOrganization(
  organization: Organization
): CDAOrganization | undefined {
  return {
    id: buildInstanceIdentifiersFromIdentifier(organization.identifier),
    name: withoutNullFlavorString(organization.name),
    telecom: buildTelecom(organization.telecom),
    addr: buildAddress(organization.address),
  };
}

export function formatDateToCDATimeStamp(dateString: string | undefined): string | undefined {
  if (!dateString) {
    return undefined;
  }
  const formatted = dateString.replace(/-/g, "");
  if (formatted.includes("T")) return formatted.split("T")[0];
  return formatted;
}

export function formatDateToHumanReadableFormat(
  dateString: string | undefined
): string | undefined {
  const date = formatDateToCDATimeStamp(dateString);
  if (!date) return undefined;

  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

// see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-ST.html
export function buildValueST(value: string | undefined): CDAValueST | undefined {
  if (!value) return undefined;

  const valueObject: CDAValueST = {};
  valueObject[xsiTypeAttribute] = "ST";
  valueObject[namespaceXsiAttribute] = namespaceXsiValue;
  valueObject[inlineTextAttribute] = value;
  return valueObject;
}

function mapAddressUse(use: string | undefined) {
  if (!use) return undefined;
  // From PostalAddressUse of the CDA R2 IG
  switch (use.toLowerCase()) {
    case "bad address":
      return "BAD";
    case "confidential":
      return "CONF";
    case "direct":
      return "DIR";
    case "home" || "home address":
      return "H";
    case "primary home":
      return "HP";
    case "vacation home":
      return "HV";
    case "physical visit address":
      return "PHYS";
    case "postal address":
      return "PST";
    case "public":
      return "PUB";
    case "temporary":
      return "TMP";
    // from example CDAs
    case "work":
      return "WP";
  }
  return use;
}

function mapTelecomUse(use: string | undefined) {
  if (!use) return undefined;
  // From Telecom Use of the CDA R2 IG
  switch (use.toLowerCase()) {
    case "answering service":
      return "AS";
    case "emergency contact":
      return "EC";
    case "home" || "primary home":
      return "HP";
    case "vacation home":
      return "HV";
    case "mobile contact":
      return "MC";
    case "pager":
      return "PG";
    case "work" || "work place":
      return "WP";
  }
  return use;
}

function cleanUpCoding(primaryCodingRaw: Coding | undefined) {
  if (!primaryCodingRaw) return undefined;
  const system = primaryCodingRaw.system;
  switch (system) {
    case "http://loinc.org":
      return {
        system: CODING_MAP.get(system),
        code: primaryCodingRaw.code ?? "LOINC",
        display: primaryCodingRaw.display,
      };
    case "http://snomed.info/sct":
      return {
        system: CODING_MAP.get(system),
        code: primaryCodingRaw.code ?? "SNOMED-CT",
        display: primaryCodingRaw.display,
      };
    case "http://www.nlm.nih.gov/research/umls/rxnorm":
      return {
        system: CODING_MAP.get(system),
        code: primaryCodingRaw.code ?? "RXNORM",
        display: primaryCodingRaw.display,
      };
    default:
      return {
        system: system ? CODING_MAP.get(system) : primaryCodingRaw.system,
        code: primaryCodingRaw.code,
        display: primaryCodingRaw.display,
      };
  }
}

function mapCodingSystem(system: string | undefined): string | undefined {
  if (!system) return undefined;
  const mappedCodingSystem = CODING_MAP.get(system);
  if (mappedCodingSystem) return mappedCodingSystem;
  if (system.includes("urn")) return normalizeOid(system);
  return system;
}

export function buildReferenceId(prefix: string, pairNumber: number): string {
  return `${prefix}-pair${pairNumber}`;
}

export function isLoinc(system: string | undefined): boolean {
  if (system?.toLowerCase().includes("loinc")) {
    return true;
  }
  return false;
}
