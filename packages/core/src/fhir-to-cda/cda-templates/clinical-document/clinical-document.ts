import { XMLBuilder } from "fast-xml-parser";
import {
  buildCodeCE,
  buildInstanceIdentifier,
  formatDateToCDATimeStamp,
  withNullFlavor,
  withoutNullFlavorObject,
} from "../commons";
import {
  clinicalDocumentConstants,
  moodCodeAttribute,
  namespaceAttribute,
  namespaceSdtcAttribute,
  namespaceXsiAttribute,
  valueAttribute,
} from "../constants";
import {
  CDAAuthor,
  CDACodeCE,
  CDACustodian,
  CDAInstanceIdentifier,
  CDARecordTarget,
  Entry,
} from "../types";

export type ClinicalDocument = {
  ClinicalDocument: {
    [namespaceAttribute]: string;
    [namespaceSdtcAttribute]: string;
    [namespaceXsiAttribute]: string;
    [moodCodeAttribute]: string;
    realmCode?: CDACodeCE;
    typeId?: CDAInstanceIdentifier;
    templateId?: CDAInstanceIdentifier[];
    id: CDAInstanceIdentifier;
    code: CDACodeCE;
    title?: string;
    effectiveTime: Entry;
    confidentialityCode: CDACodeCE;
    languageCode?: CDACodeCE;
    setId?: CDAInstanceIdentifier;
    versionNumber?: Entry;
    recordTarget: CDARecordTarget;
    author: CDAAuthor;
    custodian: CDACustodian;
    component: unknown;
  };
};

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function removeEmptyFields(obj: any): ClinicalDocument {
  if (typeof obj === "object" && obj !== undefined) {
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value === undefined || value === "") {
        delete obj[key];
      } else if (typeof value === "object") {
        const result = removeEmptyFields(value);
        if (Object.keys(result).length === 0) {
          delete obj[key];
        }
      }
    });
    return obj;
  }
  return obj;
}

// see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-ClinicalDocument.html
export function buildClinicalDocumentXML(
  recordTarget: CDARecordTarget,
  author: CDAAuthor,
  custodian: CDACustodian,
  structuredBody: unknown
): string {
  const jsonObj: ClinicalDocument = {
    ClinicalDocument: {
      [namespaceAttribute]: "urn:hl7-org:v3",
      [namespaceSdtcAttribute]: "urn:hl7-org:sdtc",
      [namespaceXsiAttribute]: "http://www.w3.org/2001/XMLSchema-instance",
      [moodCodeAttribute]: "EVN",
      realmCode: buildCodeCE({ code: clinicalDocumentConstants.realmCode }),
      typeId: buildInstanceIdentifier({
        extension: clinicalDocumentConstants.typeIdExtension,
        root: clinicalDocumentConstants.typeIdRoot,
      }),
      templateId: clinicalDocumentConstants.templateIds.map(tid =>
        buildInstanceIdentifier({
          root: tid.root,
          extension: tid.extension,
        })
      ),
      id: buildInstanceIdentifier({
        assigningAuthorityName: clinicalDocumentConstants.assigningAuthorityName,
        root: clinicalDocumentConstants.rootOid,
      }),
      code: buildCodeCE({
        code: "NOTE-TYPE", // TODO: Make this dynamic. IMPORTANT
        codeSystem: clinicalDocumentConstants.code.codeSystem,
        codeSystemName: clinicalDocumentConstants.code.codeSystemName,
        displayName: "NOTE-NAME", // TODO: Make this dynamic. IMPORTANT
      }),
      title: "NOTE-TITLE", // TODO: Make this dynamic. IMPORTANT
      effectiveTime: withNullFlavor(
        formatDateToCDATimeStamp(new Date().toISOString()),
        valueAttribute
      ),
      confidentialityCode: buildCodeCE({
        code: clinicalDocumentConstants.confidentialityCode.code,
        codeSystem: clinicalDocumentConstants.confidentialityCode.codeSystem,
        displayName: clinicalDocumentConstants.confidentialityCode.displayName,
      }),
      languageCode: buildCodeCE({
        code: clinicalDocumentConstants.languageCode,
      }),
      setId: buildInstanceIdentifier({
        assigningAuthorityName: clinicalDocumentConstants.assigningAuthorityName,
        root: clinicalDocumentConstants.rootOid,
      }),
      versionNumber: withoutNullFlavorObject(
        clinicalDocumentConstants.versionNumber,
        valueAttribute
      ),
      recordTarget,
      author,
      custodian,
      component: structuredBody,
    },
  };
  const cleanedJsonObj = removeEmptyFields(jsonObj);
  const builder = new XMLBuilder({
    format: false,
    ignoreAttributes: false,
  });

  return builder.build(cleanedJsonObj);
}
