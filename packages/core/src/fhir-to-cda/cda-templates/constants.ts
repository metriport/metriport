import { Config } from "../../util/config";
const metriportOid = Config.getSystemRootOID();

export const _xsiTypeAttribute = "_xsi:type";
export const _xmlnsSdtcAttribute = "_xmlns:sdtc";
export const _xmlnsXsiAttribute = "_xmlns:xsi";
export const _xmlnsXsiValue = "http://www.w3.org/2001/XMLSchema-instance";
export const loincSystemCode = "2.16.840.1.113883.6.1";
export const snomedSystemCode = "2.16.840.1.113883.6.96";
export const nlmNihSystemCode = "2.16.840.1.113883.6.88";
export const amaAssnSystemCode = "2.16.840.1.113883.6.12";
export const fdasisSystemCode = "2.16.840.1.113883.4.9";
export const icd10SystemCode = "2.16.840.1.113883.6.90";
export const extensionValue2014 = "2014-06-09";
export const extensionValue2015 = "2015-08-01";
export const loincCodeSystem = "2.16.840.1.113883.6.1";
export const loincSystemName = "LOINC";
export const placeholderOrgOid = "placeholder-ORG-OID";
export const NOT_SPECIFIED = "Not Specified";

// Codes taken from: https://www.hl7.org/ccdasearch/
export const oids = {
  medicationsSection: "2.16.840.1.113883.10.20.22.2.1.1",
  mentalStatusSection: "2.16.840.1.113883.10.20.22.2.56",
  problemsSection: "2.16.840.1.113883.10.20.22.2.5.1",
  resultsSection: "2.16.840.1.113883.10.20.22.2.3.1",
  socialHistorySection: "2.16.840.1.113883.10.20.22.2.17",
  encountersSection: "2.16.840.1.113883.10.20.22.2.22",
  allergiesSection: "2.16.840.1.113883.10.20.22.2.6.1",
  problemConcernAct: "2.16.840.1.113883.10.20.22.4.3",
  socialHistoryObs: "2.16.840.1.113883.10.20.22.4.38",
  medicationActivity: "2.16.840.1.113883.10.20.22.4.16",
  mentalStatusObs: "2.16.840.1.113883.10.20.22.4.74",
  problemObs: "2.16.840.1.113883.10.20.22.4.4",
  resultOrganizer: "2.16.840.1.113883.10.20.22.4.1",
  medicationInformation: "2.16.840.1.113883.10.20.22.4.23",
  resultObs: "2.16.840.1.113883.10.20.22.4.2",
  allergyConcernAct: "2.16.840.1.113883.10.20.22.4.30",
  allergyIntoleranceObservation: "2.16.840.1.113883.10.20.22.4.7",
  reactionObservation: "2.16.840.1.113883.10.20.22.4.9",
  encounterActivity: "2.16.840.1.113883.10.20.22.4.49",
  encounterDiagnosis: "2.16.840.1.113883.10.20.22.4.80",
};

export const mentalHealthSurveyCodes = ["44249-1"];
export const socialHistorySurveyCodes = ["lg51306-5"];

export const clinicalDocumentConstants = {
  realmCode: "US",
  typeIdExtension: "POCD_HD000040",
  typeIdRoot: "2.16.840.1.113883.1.3",
  templateIds: [
    { root: "2.16.840.1.113883.10.20.22.1.1", extension: extensionValue2015 },
    { root: "2.16.840.1.113883.10.20.22.1.9", extension: extensionValue2015 },
  ],
  assigningAuthorityName: "METRIPORT",
  rootOid: metriportOid,
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
