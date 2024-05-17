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
  ObservationTableRow,
} from "../cda-types/shared-types";
import {
  _assigningAuthorityNameAttribute,
  _codeAttribute,
  _codeSystemAttribute,
  _codeSystemNameAttribute,
  _displayNameAttribute,
  _extensionAttribute,
  _idAttribute,
  _inlineTextAttribute,
  _nullFlavorAttribute,
  _rootAttribute,
  _useAttribute,
  _valueAttribute,
  _xmlnsXsiAttribute,
  _xsiTypeAttribute,
  amaAssnSystemCode,
  fdasisSystemCode,
  loincSystemCode,
  nlmNihSystemCode,
  placeholderOrgOid,
  snomedSystemCode,
} from "./constants";

const CODING_MAP = new Map<string, string>();
CODING_MAP.set("http://loinc.org", loincSystemCode);
CODING_MAP.set("http://snomed.info/sct", snomedSystemCode);
CODING_MAP.set("http://www.nlm.nih.gov/research/umls/rxnorm", nlmNihSystemCode);
CODING_MAP.set("http://www.ama-assn.org/go/cpt", amaAssnSystemCode);
CODING_MAP.set("http://fdasis.nlm.nih.gov", fdasisSystemCode);

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
  if (value == undefined) return { [_nullFlavorAttribute]: "UNK" };
  return { [key]: value };
}

// see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-CE.html for CE type
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
  if (code) codeObject[_codeAttribute] = code.trim();
  if (mappedCodeSystem) codeObject[_codeSystemAttribute] = mappedCodeSystem;
  if (codeSystemName) codeObject[_codeSystemNameAttribute] = codeSystemName.trim();
  if (displayName) codeObject[_displayNameAttribute] = displayName.trim();

  return codeObject;
}

export function buildOriginalTextReference(value: string): CDAOriginalText {
  return {
    reference: {
      [_valueAttribute]: value,
    },
  };
}

// see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-CV.html for CV type
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
  if (root) identifier[_rootAttribute] = root;
  if (extension) identifier[_extensionAttribute] = extension;
  if (assigningAuthorityName) identifier[_assigningAuthorityNameAttribute] = assigningAuthorityName;

  return identifier;
}

export function buildInstanceIdentifiersFromIdentifier(
  identifiers?: Identifier | Identifier[] | undefined
): CdaInstanceIdentifier[] | Entry {
  if (!identifiers) {
    return withNullFlavor(undefined, _rootAttribute);
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
      ...withoutNullFlavorObject(telecomUse, _useAttribute),
      ...withoutNullFlavorObject(telecom.value, _valueAttribute),
    };
  });
}

export function buildAddress(address?: Address[]): CdaAddress[] | undefined {
  return address?.map(addr => ({
    ...withoutNullFlavorObject(mapAddressUse(addr.use), _useAttribute),
    streetAddressLine: addr.line?.join(", "),
    city: addr.city,
    state: addr.state,
    postalCode: addr.postalCode,
    country: addr.country,
    useablePeriod: {
      low: withoutNullFlavorObject(addr.period?.start, _valueAttribute),
      high: withoutNullFlavorObject(addr.period?.end, _valueAttribute),
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

export function formatDateToCdaTimestamp(dateString: string | undefined): string | undefined {
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
  const date = formatDateToCdaTimestamp(dateString);
  if (!date) return undefined;

  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

// see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-ST.html
export function buildValueSt(value: string | undefined): CdaValueSt | undefined {
  if (!value) return undefined;

  const valueObject: CdaValueSt = {};
  valueObject[_xsiTypeAttribute] = "ST";
  valueObject[_xmlnsXsiAttribute] = "http://www.w3.org/2001/XMLSchema-instance";
  valueObject[_inlineTextAttribute] = value;
  return valueObject;
}

export function buildValueCd(
  codeableConcept: CodeableConcept | undefined,
  referenceId: string
): CdaValueCd | undefined {
  const valueObject: CdaValueCd = {
    [_xsiTypeAttribute]: "CD",
    [_codeAttribute]: codeableConcept?.coding?.[0]?.code,
    [_codeSystemAttribute]: mapCodingSystem(codeableConcept?.coding?.[0]?.system),
    [_displayNameAttribute]: codeableConcept?.coding?.[0]?.display,
    originalText: {
      reference: {
        [_valueAttribute]: referenceId,
      },
    },
  };
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

export function createTableHeader(tableHeaders: string[]) {
  return {
    tr: [
      {
        th: tableHeaders,
      },
    ],
  };
}

export function getTextFromCode(code: CodeableConcept | undefined): string {
  if (!code) return "Unknown";
  const primaryCoding = code.coding?.[0];
  return primaryCoding?.display ?? code.text ?? "Unknown";
}

export function initiateSectionTable(
  sectionName: string,
  tableHeaders: string[],
  tableRows: ObservationTableRow[]
) {
  return {
    [_idAttribute]: sectionName,
    thead: createTableHeader(tableHeaders),
    tbody: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tr: tableRows.map((row: { tr: { [x: string]: any; td: any } }) => ({
        [_idAttribute]: row.tr[_idAttribute],
        td: row.tr.td,
      })),
    },
  };
}
