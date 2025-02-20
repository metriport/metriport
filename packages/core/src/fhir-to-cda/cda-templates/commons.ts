import {
  Address,
  Annotation,
  CodeableConcept,
  Coding,
  ContactPoint,
  Identifier,
  Location,
  Organization,
  Practitioner,
} from "@medplum/fhirtypes";
import { normalizeOid, toArray } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import utc from "dayjs/plugin/utc";
import {
  AssignedEntity,
  CdaAddress,
  CdaAddressUse,
  CdaCodeCe,
  CdaCodeCv,
  CdaGender,
  CdaInstanceIdentifier,
  CdaOrganization,
  CdaOriginalText,
  CdaTelecom,
  CdaTelecomUse,
  CdaValueCd,
  CdaValueEd,
  CdaValueSt,
  Entry,
  EntryObject,
  Participant,
  TextParagraph,
} from "../cda-types/shared-types";
import {
  amaAssnSystemCode,
  extensionValue2014,
  fdasisSystemCode,
  hl7ActCode,
  icd10SystemCode,
  loincCodeSystem,
  loincSystemCode,
  loincSystemName,
  nlmNihSystemCode,
  NOT_SPECIFIED,
  oids,
  placeholderOrgOid,
  providerTaxonomy,
  snomedSystemCode,
  vaccineAdministeredCodeSet,
  _xmlnsXsiAttribute,
  _xsiTypeAttribute,
} from "./constants";

dayjs.extend(localizedFormat);
dayjs.extend(utc);

const CODING_MAP = new Map<string, string>();
CODING_MAP.set("http://loinc.org", loincSystemCode);
CODING_MAP.set("http://snomed.info/sct", snomedSystemCode);
CODING_MAP.set("http://www.nlm.nih.gov/research/umls/rxnorm", nlmNihSystemCode);
CODING_MAP.set("http://www.ama-assn.org/go/cpt", amaAssnSystemCode);
CODING_MAP.set("http://fdasis.nlm.nih.gov", fdasisSystemCode);
CODING_MAP.set("http://terminology.hl7.org/codesystem/v3-actcode", hl7ActCode);
CODING_MAP.set("http://nucc.org/provider-taxonomy", providerTaxonomy);
CODING_MAP.set("http://hl7.org/fhir/sid/cvx", vaccineAdministeredCodeSet);

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

export function withNullFlavor(value: string | undefined, key: string): EntryObject {
  if (value == undefined) return { _nullFlavor: "UNK" };
  return { [key]: value };
}

export function buildCodeCeFromCoding(
  coding: Coding | Coding[] | undefined
): CdaCodeCe | undefined {
  if (!coding) return;
  const primaryCoding = toArray(coding)[0];
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
  if (codeSystemName) codeObject._codeSystemName = codeSystemName.toString().trim();
  if (displayName) codeObject._displayName = displayName.toString().trim();

  return codeObject;
}

export function buildOriginalTextReference(value: string): CdaOriginalText {
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
  codeableConcept: CodeableConcept | CodeableConcept[] | undefined,
  textReference?: string
): CdaCodeCv | undefined {
  if (!codeableConcept) {
    return undefined;
  }

  const codeableConceptArray = toArray(codeableConcept);
  const codings: Coding[] = codeableConceptArray.flatMap(concept => concept.coding || []);

  const primaryCodingRaw = codings[0];
  const primaryCoding = cleanUpCoding(primaryCodingRaw);
  const baseCE = primaryCoding
    ? buildCodeCe({
        code: primaryCoding.code,
        codeSystem: primaryCoding.system,
        codeSystemName: undefined,
        displayName: primaryCoding.display,
      })
    : {};

  // TODO: Use term server to include a LOINC code
  const translations = (codings.slice(1) || []).map(coding =>
    buildCodeCe({
      code: coding.code,
      codeSystem: mapCodingSystem(coding.system),
      codeSystemName: undefined,
      displayName: coding.display,
    })
  );

  const codeCV: CdaCodeCv = {
    ...baseCE,
    originalText: textReference
      ? buildOriginalTextReference(textReference)
      : codeableConceptArray[0]?.text,
    translation: translations?.length ? translations : undefined,
  };

  return codeCV;
}

export function buildCodeCvFromCodeCe(codeCe: CdaCodeCe, concepts: CodeableConcept[] | undefined) {
  const codeCv: CdaCodeCv = {
    ...codeCe,
  };

  if (!concepts) return codeCv;

  const translations = concepts.flatMap(
    concept =>
      concept.coding?.flatMap(coding => {
        if (coding.code === codeCe._code) return [];
        return buildCodeCe({
          code: coding.code,
          codeSystem: mapCodingSystem(coding.system),
          codeSystemName: undefined,
          displayName: coding.display,
        });
      }) || []
  );
  codeCv.translation = translations;
  return codeCv;
}

export function buildCodeCv(providedCode: CdaCodeCe, codeLoinc?: Partial<CdaCodeCe[]>) {
  const isLoincCode = isLoinc(providedCode._codeSystemName);
  if (isLoincCode) {
    return providedCode;
  }

  const loincCode = buildCodeCe({
    code: codeLoinc?.[0]?._code, // TODO: Use term server to get the actual LOINC code
    codeSystem: loincCodeSystem,
    codeSystemName: loincSystemName,
  });

  return {
    ...providedCode,
    translation: [loincCode, ...(codeLoinc?.slice(1) || [])],
  };
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

export function buildTemplateIds({
  root,
  extension,
}: {
  root: string;
  extension?: string;
}): CdaInstanceIdentifier[] {
  const templateIds = [buildInstanceIdentifier({ root })];
  if (extension) {
    templateIds.push(buildInstanceIdentifier({ root, extension }));
  }
  return templateIds;
}

export function buildInstanceIdentifiersFromIdentifier(
  identifiers?: Identifier | Identifier[] | undefined
): CdaInstanceIdentifier[] | Entry {
  if (!identifiers) {
    return withNullFlavor(undefined, "_root");
  }

  const identifiersArray = toArray(identifiers);
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

export function buildAddress(address: Address | Address[] | undefined): CdaAddress[] | undefined {
  if (!address) return undefined;
  const addressArray = toArray(address);
  return addressArray?.map(addr => ({
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

  const date = buildDayjs(dateString);

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

  const date = buildDayjs(dateString);

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
 * ED stands for EncapsulatedData
 * @see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-ED.html for more details
 */
export function buildValueEd(reference: string | undefined): CdaValueEd | undefined {
  if (!reference) return undefined;

  const valueObject: CdaValueEd = {};
  valueObject[_xsiTypeAttribute] = "ED";
  valueObject[_xmlnsXsiAttribute] = "http://www.w3.org/2001/XMLSchema-instance";
  valueObject.reference = {
    _value: `#${reference}`,
  };

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
function mapAddressUse(use: string | undefined): CdaAddressUse | undefined {
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
    default:
      return "BAD";
  }
}

/**
 * Mapping options from Telecom Use of the CDA R2 IG
 */
function mapTelecomUse(use: string | undefined): CdaTelecomUse | undefined {
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
    default:
      return "WP";
  }
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
    case "http://nucc.org/provider-taxonomy":
      return {
        system: CODING_MAP.get(system),
        code: primaryCodingRaw.code ?? "NUCC",
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
  return code.text ?? primaryCoding?.display ?? NOT_SPECIFIED;
}

export function getDisplaysFromCodeableConcepts(
  concepts: CodeableConcept | CodeableConcept[] | undefined
): string | undefined {
  if (!concepts) return undefined;
  return toArray(concepts)
    .map(concept => {
      const code = buildCodeCeFromCoding(concept.coding);
      if (code?._displayName) return code._displayName.trim();
      if (concept.text) return concept.text.trim();
      return;
    })
    .join(", ");
}

export function buildPerformer(practitioners: Practitioner[] | undefined): AssignedEntity[] {
  return (
    practitioners?.flatMap(p => {
      return (
        {
          assignedEntity: {
            id: buildInstanceIdentifier({
              root: placeholderOrgOid,
              extension: p.id,
            }),
            code: p.qualification?.flatMap(
              qualif => buildCodeCvFromCodeableConcept(qualif.code) || []
            ),
            addr: buildAddress(p.address),
            telecom: buildTelecom(p.telecom),
            assignedPerson: {
              name: {
                given: p.name
                  ?.flatMap(n => `${n.given}${n.suffix ? `, ${n.suffix}` : ""}`)
                  .join(", "),
                family: p.name?.flatMap(n => n.family).join(", "),
              },
            },
            representedOrganization: {
              _classCode: "ORG",
              name: {
                "#text": "",
              },
              telecom: buildTelecom(p.telecom),
              addr: buildAddress(p.address),
            },
          },
        } || []
      );
    }) || []
  );
}

export function buildPerformerFromLocation(
  location: Location | undefined
): AssignedEntity | undefined {
  if (!location) return undefined;
  return {
    assignedEntity: {
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: location.id,
      }),
      addr: buildAddress(location.address),
      telecom: buildTelecom(location.telecom),
      representedOrganization: {
        _classCode: "ORG",
        name: {
          "#text": "",
        },
        addr: buildAddress(location.address),
        telecom: buildTelecom(location.telecom),
      },
    },
  };
}

export function buildParticipant(locations: Location[] | undefined): Participant[] | undefined {
  if (!locations) return undefined;

  return locations.map(location => {
    const participant: Participant = {
      _typeCode: "LOC",
      participantRole: {
        _classCode: "SDLOC",
        templateId: buildTemplateIds({
          root: oids.serviceDeliveryLocation, // TODO: Check that this is correct
          extension: extensionValue2014,
        }),
        id: buildInstanceIdentifier({
          root: placeholderOrgOid,
          extension: location.id,
        }),
        code: {
          _nullFlavor: "NI",
        },
        addr: buildAddress(location.address),
        telecom: buildTelecom(location.telecom),
        playingEntity: {
          _classCode: "PLC",
          ...(location.name && {
            name: {
              "#text": location.name,
            },
          }),
        },
      },
    };
    return participant;
  });
}

export function buildAddressText(address: Address | undefined): string | undefined {
  if (!address) return undefined;
  return `${address.line?.join(", ")}, ${address.city}, ${address.state} ${address.postalCode}`;
}

export function getNotes(note: Annotation[] | undefined): string | undefined {
  const combinedNotes = note?.map(note => note.text).join("; ");
  return combinedNotes?.length ? combinedNotes : undefined;
}

export function buildCdaGender(gender: string | undefined): EntryObject {
  const cdaGender = mapFhirGenderToCda(gender);
  if (!cdaGender) return withNullFlavor(undefined, "_code");

  return buildCodeCe({
    code: cdaGender,
    codeSystem: "2.16.840.1.113883.5.1",
    codeSystemName: "AdministrativeGender",
  });
}

/**
 * For FHIR genders:
 * @see https://hl7.org/fhir/R4/valueset-administrative-gender.html
 * For CDA genders:
 * @see https://terminology.hl7.org/5.2.0/ValueSet-v3-AdministrativeGender.html
 */
export function mapFhirGenderToCda(gender: string | undefined): CdaGender {
  switch (gender?.toLowerCase().trim()) {
    case "male":
      return "M";
    case "female":
      return "F";
    case "other":
      return "UN";
    default:
      return undefined;
  }
}

export const notOnFilePlaceholder: TextParagraph = {
  paragraph: {
    "#text": "Not on file",
  },
};
