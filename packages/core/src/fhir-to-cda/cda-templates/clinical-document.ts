import { XMLBuilder } from "fast-xml-parser";
import {
  CDAAuthor,
  CDACustodian,
  CDAInstanceIdentifier,
  CDARecordTarget,
  CDACodeCE,
  Entry,
} from "./types";
import { buildCodeCE, buildInstanceIdentifier } from "./utils";

// Constants for dynamic values
const CONSTANTS = {
  realmCode: "US",
  typeIdExtension: "POCD_HD000040",
  typeIdRoot: "2.16.840.1.113883.1.3",
  templateIds: [
    { root: "1.2.840.114350.1.72.1.51693" },
    { root: "2.16.840.1.113883.10.20.22.1.1", extension: "2015-08-01" },
    { root: "2.16.840.1.113883.10.20.22.1.9", extension: "2015-08-01" },
  ],
  assigningAuthorityName: "METRIPORT",
  idRoot: "OUR-ORGANIZATION-ID",
  code: {
    code: "<NOTE-TYPE>",
    codeSystem: "2.16.840.1.113883.6.1",
    codeSystemName: "LOINC",
    displayName: "<NOTE-NAME>",
  },
  title: "<NOTE-TITLE>",
  effectiveTime: "<EFFECTIVE-TIME>", // TODO: Replace with current date. IMPORTANT
  confidentialityCode: {
    code: "N",
    codeSystem: "2.16.840.1.113883.5.25",
    displayName: "Normal",
  },
  languageCode: "en-US",
  setId: {
    assigningAuthorityName: "METRIPORT",
    extension: "<OUR-EXTENSION>",
    root: "<OUR-ID>",
  },
  versionNumber: "3",
};

export type ClinicalDocument = {
  ClinicalDocument: {
    "@_xmlns": string;
    realmCode: CDACodeCE;
    typeId: CDAInstanceIdentifier;
    templateId: CDAInstanceIdentifier[];
    id: CDAInstanceIdentifier;
    code: CDACodeCE;
    title: string;
    effectiveTime: Entry;
    confidentialityCode: CDACodeCE;
    languageCode: CDACodeCE;
    setId: CDAInstanceIdentifier;
    versionNumber: Entry;
    recordTarget: CDARecordTarget;
    author: CDAAuthor;
    custodian: CDACustodian;
    component: unknown; // The structured body or component of the Clinical Document
  };
};

// see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-ClinicalDocument.html
export function buildClinicalDocumentXML(
  recordTarget: CDARecordTarget,
  author: CDAAuthor,
  custodian: CDACustodian,
  structuredBody: unknown
): string {
  const jsonObj: ClinicalDocument = {
    ClinicalDocument: {
      "@_xmlns": "urn:hl7-org:v3",
      realmCode: buildCodeCE({ code: CONSTANTS.realmCode }),
      typeId: buildInstanceIdentifier({
        extension: CONSTANTS.typeIdExtension,
        root: CONSTANTS.typeIdRoot,
      }),
      templateId: CONSTANTS.templateIds.map(tid =>
        buildInstanceIdentifier({
          root: tid.root,
          extension: tid.extension,
        })
      ),
      id: buildInstanceIdentifier({
        // REQUIRED
        assigningAuthorityName: CONSTANTS.assigningAuthorityName,
        root: CONSTANTS.idRoot,
      }),
      code: buildCodeCE({
        // REQUIRED
        code: CONSTANTS.code.code,
        codeSystem: CONSTANTS.code.codeSystem,
        codeSystemName: CONSTANTS.code.codeSystemName,
        displayName: CONSTANTS.code.displayName,
      }),
      title: CONSTANTS.title,
      effectiveTime: { "@_value": CONSTANTS.effectiveTime }, // REQUIRED
      confidentialityCode: buildCodeCE({
        // REQUIRED
        code: CONSTANTS.confidentialityCode.code,
        codeSystem: CONSTANTS.confidentialityCode.codeSystem,
        displayName: CONSTANTS.confidentialityCode.displayName,
      }),
      languageCode: buildCodeCE({
        code: CONSTANTS.languageCode,
      }),
      setId: buildInstanceIdentifier({
        assigningAuthorityName: CONSTANTS.setId.assigningAuthorityName,
        extension: CONSTANTS.setId.extension,
        root: CONSTANTS.setId.root,
      }),
      versionNumber: { "@_value": CONSTANTS.versionNumber },
      recordTarget, // REQUIRED
      author, // REQUIRED
      custodian, // REQUIRED
      component: structuredBody, // REQUIRED
    },
  };

  const builder = new XMLBuilder({
    format: false,
    ignoreAttributes: false,
  });

  return builder.build(jsonObj);
}
