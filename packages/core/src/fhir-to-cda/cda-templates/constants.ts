export const _nullFlavorAttribute = "_nullFlavor";
export const _rootAttribute = "_root";
export const _extensionAttribute = "_extension";
export const _assigningAuthorityNameAttribute = "_assigningAuthorityName";
export const _valueAttribute = "_value";
export const _useAttribute = "_use";
export const _idAttribute = "_ID";
export const _styleCodeAttribute = "_styleCode";
export const _classCodeAttribute = "_classCode";
export const _moodCodeAttribute = "_moodCode";
export const _typeCodeAttribute = "_typeCode";
export const _codeAttribute = "_code";
export const _codeSystemAttribute = "_codeSystem";
export const _codeSystemNameAttribute = "_codeSystemName";
export const _displayNameAttribute = "_displayName";
export const _namespaceAttribute = "_xmlns";
export const _xsiTypeAttribute = "_xsi:type";
export const _xmlnsXsiAttribute = "_xmlns:xsi";
export const _inlineTextAttribute = "_text";
export const loincSystemCode = "2.16.840.1.113883.6.1";
export const snomedSystemCode = "2.16.840.1.113883.6.96";
export const nlmNihSystemCode = "2.16.840.1.113883.6.88";
export const amaAssnSystemCode = "2.16.840.1.113883.6.12";
export const fdasisSystemCode = "2.16.840.1.113883.4.9";

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
    codeSystem: loincSystemCode,
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
