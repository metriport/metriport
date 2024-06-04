import {
  Address,
  CodeableConcept,
  Coding,
  ContactPoint,
  Identifier,
  Organization,
} from "@medplum/fhirtypes";
import { normalizeOid } from "@metriport/shared";
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import utc from "dayjs/plugin/utc";
import {
  CDAOriginalText,
  CdaAddress,
  CdaCodeCe,
  CdaCodeCv,
  CdaInstanceIdentifier,
  CdaOrganization,
  CdaTelecom,
  CdaValueCd,
  CdaValueSt,
  Entry,
  EntryObject,
} from "../cda-types/shared-types";
import {
  NOT_SPECIFIED,
  _xmlnsXsiAttribute,
  _xsiTypeAttribute,
  amaAssnSystemCode,
  fdasisSystemCode,
  icd10SystemCode,
  loincSystemCode,
  nlmNihSystemCode,
  placeholderOrgOid,
  snomedSystemCode,
} from "./constants";

dayjs.extend(localizedFormat);
dayjs.extend(utc);

const CODING_MAP = new Map<string, string>();
CODING_MAP.set("http://loinc.org", loincSystemCode);
CODING_MAP.set("http://snomed.info/sct", snomedSystemCode);
CODING_MAP.set("http://www.nlm.nih.gov/research/umls/rxnorm", nlmNihSystemCode);
CODING_MAP.set("http://www.ama-assn.org/go/cpt", amaAssnSystemCode);
CODING_MAP.set("http://fdasis.nlm.nih.gov", fdasisSystemCode);
CODING_MAP.set("icd-10", icd10SystemCode);

export const TIMESTAMP_CLEANUP_REGEX = /-|T|:|\.\d+Z$/g;
export function withoutNullFlavorObject(value: string | undefined, key: string): EntryObject {
  if (value == undefined) return {};
  return { [key]: value };
}

export function withoutNullFlavorString(value: string | undefined): Entry {
  if (value == undefined) return {};
  return value;
}

export function withNullFlavor(value: string | undefined, key: string): Entry {
  if (value == undefined) return { _nullFlavor: "UNK" };
  return { [key]: value };
}

export function buildCodeCeFromCoding(coding: Coding[] | undefined): CdaCodeCe | undefined {
  if (!coding) return;
  const primaryCoding = coding[0];
  if (!primaryCoding) return;
  const cleanedUpCoding = cleanUpCoding(primaryCoding);
  return buildCodeCe({
    code: cleanedUpCoding?.code,
    codeSystem: cleanedUpCoding?.system,
    displayName: cleanedUpCoding?.display,
  });
}

/**
 * CE stands for CodedWithEquivalents
 * @see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-CE.html for more details
 */
export function buildCodeCe({
  code,
  codeSystem,
  codeSystemName,
  displayName,
}: {
  code?: string | undefined;
  codeSystem?: string | undefined;
  codeSystemName?: string | undefined;
  displayName?: string | undefined;
}): CdaCodeCe {
  const codeObject: CdaCodeCe = {};
  const mappedCodeSystem = mapCodingSystem(codeSystem?.trim());
  if (code) codeObject._code = code.trim();
  if (mappedCodeSystem) codeObject._codeSystem = mappedCodeSystem;
  if (codeSystemName) codeObject._codeSystemName = codeSystemName.trim();
  if (displayName) codeObject._displayName = displayName.trim();

  return codeObject;
}

export function buildOriginalTextReference(value: string): CDAOriginalText {
  return {
    reference: {
      _value: value,
    },
  };
}

/**
 * CV stands for CodedValue
 * @see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-CV.html for more details
 */
export function buildCodeCvFromCodeableConcept(
  codeableConcept: CodeableConcept | undefined,
  textReference?: string
): CdaCodeCv | Entry {
  if (!codeableConcept) {
    return withoutNullFlavorString(codeableConcept);
  }

  const primaryCodingRaw = codeableConcept.coding?.[0];
  const primaryCoding = cleanUpCoding(primaryCodingRaw);
  const baseCE = primaryCoding
    ? buildCodeCe({
        code: primaryCoding.code,
        codeSystem: primaryCoding.system,
        codeSystemName: undefined,
        displayName: primaryCoding.display,
      })
    : {};

  const translations = (codeableConcept.coding || []).map(coding =>
    buildCodeCe({
      code: coding.code,
      codeSystem: mapCodingSystem(coding.system),
      codeSystemName: undefined,
      displayName: coding.display,
    })
  );

  const codeCV: CdaCodeCv = {
    ...baseCE,
    originalText: textReference ? buildOriginalTextReference(textReference) : codeableConcept.text,
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
}): CdaInstanceIdentifier {
  const identifier: CdaInstanceIdentifier = {};
  if (root) identifier._root = root;
  if (extension) identifier._extension = extension;
  if (assigningAuthorityName) identifier._assigningAuthorityName = assigningAuthorityName;

  return identifier;
}

export function buildInstanceIdentifiersFromIdentifier(
  identifiers?: Identifier | Identifier[] | undefined
): CdaInstanceIdentifier[] | Entry {
  if (!identifiers) {
    return withNullFlavor(undefined, "_root");
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

export function buildTelecom(telecoms: ContactPoint[] | undefined): CdaTelecom[] {
  if (!telecoms) {
    return [];
  }
  return telecoms.map(telecom => {
    const telecomUse = mapTelecomUse(telecom.use);
    return {
      ...withoutNullFlavorObject(telecomUse, "_use"),
      ...withoutNullFlavorObject(telecom.value, "_value"),
    };
  });
}

export function buildAddress(address?: Address[]): CdaAddress[] | undefined {
  return address?.map(addr => ({
    ...withoutNullFlavorObject(mapAddressUse(addr.use), "_use"),
    streetAddressLine: addr.line?.join(", "),
    city: addr.city,
    state: addr.state,
    postalCode: addr.postalCode,
    country: addr.country,
    useablePeriod: {
      low: withoutNullFlavorObject(addr.period?.start, "_value"),
      high: withoutNullFlavorObject(addr.period?.end, "_value"),
    },
  }));
}

export function buildRepresentedOrganization(
  organization: Organization
): CdaOrganization | undefined {
  return {
    id: buildInstanceIdentifiersFromIdentifier(organization.identifier),
    name: withoutNullFlavorString(organization.name),
    telecom: buildTelecom(organization.telecom),
    addr: buildAddress(organization.address),
  };
}

const timeOffsetRegex = /([+-](?:2[0-3]|[01][0-9]):[0-5][0-9])$/;
export function formatDateToCdaTimestamp(dateString: string | undefined): string | undefined {
  if (!dateString) {
    return undefined;
  }

  const date = dayjs(dateString);

  if (dateString.includes("T")) {
    const match = dateString.match(timeOffsetRegex);
    if (match) {
      return date.utcOffset(match[0]).utc().format("YYYYMMDDHHmmss");
    } else if (!dateString.endsWith("Z")) {
      return date.format("YYYYMMDD");
    }
    return date.utc().format("YYYYMMDDHHmmss");
  }
  return date.utc().format("YYYYMMDD");
}

export function formatDateToHumanReadableFormat(
  dateString: string | undefined
): string | undefined {
  if (!dateString) return undefined;

  const date = dayjs(dateString);

  if (dateString.includes("T")) {
    const match = dateString.match(timeOffsetRegex);
    if (match) {
      return date.utcOffset(match[0]).utc().format("MM/DD/YYYY h:mm A");
    } else if (!dateString.endsWith("Z")) {
      return date.format("MM/DD/YYYY");
    }
    return date.utc().format("MM/DD/YYYY h:mm A");
  }
  return date.utc().format("MM/DD/YYYY");
}

/**
 * ST stands for SimpleText
 * @see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-ST.html for more details
 */
export function buildValueSt(value: string | undefined): CdaValueSt | undefined {
  if (!value) return undefined;

  const valueObject: CdaValueSt = {};
  valueObject[_xsiTypeAttribute] = "ST";
  valueObject[_xmlnsXsiAttribute] = "http://www.w3.org/2001/XMLSchema-instance";
  valueObject["#text"] = value;
  return valueObject;
}

/**
 * CD stands for ConceptDescriptor
 * @see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-CD.html for more details
 */
export function buildValueCd(
  codeableConcept: CodeableConcept | undefined,
  referenceId: string
): CdaValueCd | undefined {
  const valueObject: CdaValueCd = {
    [_xsiTypeAttribute]: "CD",
    _code: codeableConcept?.coding?.[0]?.code,
    _codeSystem: mapCodingSystem(codeableConcept?.coding?.[0]?.system),
    _displayName: codeableConcept?.coding?.[0]?.display,
    originalText: {
      reference: {
        _value: referenceId,
      },
    },
  };
  return valueObject;
}

/**
 * Mapping options for the PostalAddressUse from the CDA R2 IG
 */
function mapAddressUse(use: string | undefined) {
  if (!use) return undefined;
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

/**
 * Mapping options from Telecom Use of the CDA R2 IG
 */
function mapTelecomUse(use: string | undefined) {
  if (!use) return undefined;
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
  const codingSystem = system ? CODING_MAP.get(system) : undefined;
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
        system: codingSystem ?? system,
        code: primaryCodingRaw.code,
        display: primaryCodingRaw.display,
      };
  }
}

export function mapCodingSystem(system: string | undefined): string | undefined {
  if (!system) return undefined;
  const systemLowerCase = system.toLowerCase();
  const mappedCodingSystem = CODING_MAP.get(systemLowerCase);
  if (mappedCodingSystem) return mappedCodingSystem;
  if (systemLowerCase.includes("urn")) return normalizeOid(systemLowerCase);
  return systemLowerCase;
}

export function buildReferenceId(prefix: string, pairNumber: number): string {
  return `${prefix}-pair${pairNumber}`;
}

export function isLoinc(system: string | undefined): boolean {
  if (system?.toLowerCase().trim().includes("loinc")) {
    return true;
  }
  return false;
}

export function getTextFromCode(code: CodeableConcept | undefined): string {
  if (!code) return NOT_SPECIFIED;
  const primaryCoding = code.coding?.[0];
  return primaryCoding?.display ?? code.text ?? NOT_SPECIFIED;
}
