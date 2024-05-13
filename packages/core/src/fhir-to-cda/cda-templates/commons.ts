import {
  Address,
  CodeableConcept,
  ContactPoint,
  Identifier,
  Organization,
} from "@medplum/fhirtypes";
import {
  CdaAddress,
  CdaCodeCe,
  CdaCodeCv,
  CdaInstanceIdentifier,
  CdaOrganization,
  CdaTelecom,
  Entry,
  EntryObject,
} from "../cda-types/shared-types";
import {
  assigningAuthorityNameAttribute,
  extensionAttribute,
  nullFlavorAttribute,
  rootAttribute,
  useAttribute,
  valueAttribute,
} from "./constants";

export function withoutNullFlavorObject(value: string | undefined, key: string): EntryObject {
  if (value == undefined) return {};
  return { [key]: value };
}

export function withoutNullFlavorString(value: string | undefined): Entry {
  if (value == undefined) return {};
  return value;
}

export function withNullFlavor(value: string | undefined, key: string): Entry {
  if (value == undefined) return { [nullFlavorAttribute]: "UNK" };
  return { [key]: value };
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
}): CdaCodeCe {
  const codeObject: CdaCodeCe = {};
  if (code) codeObject["@_code"] = code;
  if (codeSystem) codeObject["@_codeSystem"] = codeSystem;
  if (codeSystemName) codeObject["@_codeSystemName"] = codeSystemName;
  if (displayName) codeObject["@_displayName"] = displayName;

  return codeObject;
}

// see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-CV.html for CV type
export function buildCodeCVFromCodeableConcept(
  codeableConcept: CodeableConcept | undefined
): CdaCodeCv | Entry {
  if (!codeableConcept) {
    return withoutNullFlavorString(codeableConcept);
  }

  const primaryCoding = codeableConcept.coding?.[0];

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
      codeSystem: coding.system,
      codeSystemName: undefined,
      displayName: coding.display,
    })
  );

  const codeCV: CdaCodeCv = {
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
}): CdaInstanceIdentifier {
  const identifier: CdaInstanceIdentifier = {};
  if (root) identifier[rootAttribute] = root;
  if (extension) identifier[extensionAttribute] = extension;
  if (assigningAuthorityName) identifier[assigningAuthorityNameAttribute] = assigningAuthorityName;

  return identifier;
}

export function buildInstanceIdentifiersFromIdentifier(
  identifiers?: Identifier | Identifier[] | undefined
): CdaInstanceIdentifier[] | Entry {
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
      root: identifier.system,
      extension: identifier.value,
      assigningAuthorityName: identifier.assigner?.display,
    })
  );
}

export function buildTelecom(telecoms: ContactPoint[] | undefined): CdaTelecom[] {
  if (!telecoms) {
    return [];
  }
  return telecoms.map(telecom => ({
    ...withoutNullFlavorObject(telecom.use, useAttribute),
    ...withoutNullFlavorObject(telecom.value, valueAttribute),
  }));
}

export function buildAddress(address?: Address[]): CdaAddress[] | undefined {
  return address?.map(addr => ({
    ...withoutNullFlavorObject(addr.use, useAttribute),
    streetAddressLine: addr.line?.join(", "),
    city: addr.city,
    state: addr.state,
    postalCode: addr.postalCode,
    country: addr.country,
    useablePeriod: {
      low: withoutNullFlavorObject(addr.period?.start, valueAttribute),
      high: withoutNullFlavorObject(addr.period?.end, valueAttribute),
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

export function formatDateToCDATimestamp(dateString: string | undefined): string | undefined {
  if (!dateString) {
    return undefined;
  }
  const datePart = dateString.replace(/-/g, "");
  const timePart = "000000";
  const fractionalSeconds = "0000";
  const cdaTimeStamp = `${datePart}${timePart}.${fractionalSeconds}`;
  return cdaTimeStamp;
}
