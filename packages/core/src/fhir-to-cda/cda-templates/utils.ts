import { CodeableConcept, Identifier } from "@medplum/fhirtypes";

import { Entry, EntryObject, CDACodeCE, CDACodeCV, CDAInstanceIdentifier } from "./types";

export function withNullFlavorObject(value: string | undefined, key: string): EntryObject {
  if (value === undefined) {
    return {};
  } else {
    return { [key]: value };
  }
}

export function withNullFlavor(value: string | undefined, key?: string): Entry {
  if (value === undefined) {
    return { "@_nullFlavor": "UNK" };
  } else {
    return key ? { [key]: value } : value;
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
    return withNullFlavor(codeableConcept);
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

  const translations = codeableConcept.coding?.slice(1).map(coding =>
    buildCodeCE({
      code: coding.code,
      codeSystem: coding.system,
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
  if (root) identifier["@_root"] = root;
  if (extension) identifier["@_extension"] = extension;
  if (assigningAuthorityName) identifier["@_assigningAuthorityName"] = assigningAuthorityName;

  return identifier;
}

export function buildInstanceIdentifiersFromIdentifier(
  identifiers?: Identifier | Identifier[] | undefined
): CDAInstanceIdentifier[] | undefined {
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
