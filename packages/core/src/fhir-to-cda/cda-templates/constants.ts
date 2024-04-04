export const clinicalDocumentConstants = {
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
    code: "NOTE-TYPE",
    codeSystem: "2.16.840.1.113883.6.1",
    codeSystemName: "LOINC",
    displayName: "NOTE-NAME",
  },
  title: "NOTE-TITLE",
  effectiveTime: "20240101", // TODO: Replace with current date. IMPORTANT
  confidentialityCode: {
    code: "N",
    codeSystem: "2.16.840.1.113883.5.25",
    displayName: "Normal",
  },
  languageCode: "en-US",
  setId: {
    assigningAuthorityName: "METRIPORT",
    extension: "OUR-EXTENSION",
    root: "OUR-ID",
  },
  versionNumber: "3",
};

export const nullFlavorAttribute = "@_nullFlavor";
export const rootAttribute = "@_root";
export const extensionAttribute = "@_extension";
export const assigningAuthorityNameAttribute = "@_assigningAuthorityName";
export const valueAttribute = "@_value";
export const useAttribute = "@_use";
export const idAttribute = "@_ID";
export const styleCodeAttribute = "@_styleCode";
export const classCodeAttribute = "@_classCode";
export const moodCodeAttribute = "@_moodCode";
export const typeCodeAttribute = "@_typeCode";
export const codeAttribute = "@_code";
export const codeSystemAttribute = "@_codeSystem";
export const codeSystemNameAttribute = "@_codeSystemName";
export const displayNameAttribute = "@_displayName";
export const namespaceAttribute = "@_xmlns";
export const xsiTypeAttribute = "@_xsi:type";
export const xmlnsXsiAttribute = "@_xmlns:xsi";
export const inlineTextAttribute = "#text";
