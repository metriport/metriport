import { XMLBuilder } from "fast-xml-parser";

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

// see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-ClinicalDocument.html
export function constructClinicalDocumentXML(
  recordTarget: unknown,
  author: unknown,
  custodian: unknown,
  structuredBody: unknown
): string {
  const jsonObj = {
    ClinicalDocument: {
      "@_xmlns": "urn:hl7-org:v3",
      realmCode: { "@_code": CONSTANTS.realmCode },
      typeId: { "@_extension": CONSTANTS.typeIdExtension, "@_root": CONSTANTS.typeIdRoot },
      templateId: CONSTANTS.templateIds.map(tid => ({
        "@_root": tid.root,
        "@_extension": tid.extension,
      })),
      id: {
        // REQUIRED
        "@_assigningAuthorityName": CONSTANTS.assigningAuthorityName,
        "@_root": CONSTANTS.idRoot,
      },
      code: {
        // REQUIRED
        "@_code": CONSTANTS.code.code,
        "@_codeSystem": CONSTANTS.code.codeSystem,
        "@_codeSystemName": CONSTANTS.code.codeSystemName,
        "@_displayName": CONSTANTS.code.displayName,
      },
      title: CONSTANTS.title,
      effectiveTime: { "@_value": CONSTANTS.effectiveTime }, // REQUIRED
      confidentialityCode: {
        // REQUIRED
        "@_code": CONSTANTS.confidentialityCode.code,
        "@_codeSystem": CONSTANTS.confidentialityCode.codeSystem,
        "@_displayName": CONSTANTS.confidentialityCode.displayName,
      },
      languageCode: { "@_code": CONSTANTS.languageCode },
      setId: {
        "@_assigningAuthorityName": CONSTANTS.setId.assigningAuthorityName,
        "@_extension": CONSTANTS.setId.extension,
        "@_root": CONSTANTS.setId.root,
      },
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
