import { Config } from "../../util/config";
const metriportOid = Config.getSystemRootOID();

export const nullFlavorAttribute = "@_nullFlavor";
export const rootAttribute = "@_root";
export const extensionAttribute = "@_extension";
export const extensionValue2015 = "2015-08-01";
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
export const namespaceSdtcAttribute = "@_xmlns:sdtc";
export const namespaceXsiAttribute = "@_xmlns:xsi";
export const namespaceXsiValue = "http://www.w3.org/2001/XMLSchema-instance";
export const xsiTypeAttribute = "@_xsi:type";
export const inlineTextAttribute = "#text";
export const loincCodeSystem = "2.16.840.1.113883.6.1";
export const loincSystemName = "LOINC";
export const placeholderOrgOid = "placeholder-ORG-OID";

export const clinicalDocumentConstants = {
  realmCode: "US",
  typeIdExtension: "POCD_HD000040",
  typeIdRoot: "2.16.840.1.113883.1.3",
  templateIds: [
    { root: "2.16.840.1.113883.10.20.22.1.1", extension: extensionValue2015 },
    { root: "2.16.840.1.113883.10.20.22.1.9", extension: extensionValue2015 },
  ],
  assigningAuthorityName: "METRIPORT",
  idRoot: metriportOid,
  code: {
    codeSystem: "2.16.840.1.113883.6.1",
    codeSystemName: "LOINC",
  },
  confidentialityCode: {
    code: "N",
    codeSystem: "2.16.840.1.113883.5.25",
    displayName: "Normal",
  },
  languageCode: "en-US",
  versionNumber: "3",
};
