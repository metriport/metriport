import { XMLBuilder } from "fast-xml-parser";
import {
  CdaAuthor,
  CdaCustodian,
  CdaRecordTarget,
  ClinicalDocument,
} from "../../cda-types/shared-types";
import {
  buildCodeCe,
  buildInstanceIdentifier,
  formatDateToCdaTimestamp,
  withNullFlavor,
  withoutNullFlavorObject,
} from "../commons";
import {
  _moodCodeAttribute,
  _namespaceSdtcAttribute,
  _namespaceXsiAttribute,
  _valueAttribute,
  clinicalDocumentConstants,
} from "../constants";

import { _namespaceAttribute } from "../constants";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function removeEmptyFields(obj: any): unknown {
  if (typeof obj === "object" && obj != undefined) {
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value == undefined || value === "") {
        delete obj[key];
      } else if (typeof value === "object") {
        const result = removeEmptyFields(value);
        if (result && typeof result === "object" && Object.keys(result).length === 0) {
          delete obj[key];
        }
      }
    });
    return obj;
  }
  return obj;
}

// see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-ClinicalDocument.html
export function buildClinicalDocumentXml(
  recordTarget: CdaRecordTarget,
  author: CdaAuthor,
  custodian: CdaCustodian,
  structuredBody: unknown
): string {
  const jsonObj: ClinicalDocument = {
    ClinicalDocument: {
      [_namespaceAttribute]: "urn:hl7-org:v3",
      [_namespaceSdtcAttribute]: "urn:hl7-org:sdtc",
      [_namespaceXsiAttribute]: "http://www.w3.org/2001/XMLSchema-instance",
      [_moodCodeAttribute]: "EVN",
      realmCode: buildCodeCe({ code: clinicalDocumentConstants.realmCode }),
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
      code: buildCodeCe({
        code: "NOTE-TYPE", // TODO: Make this dynamic. IMPORTANT
        codeSystem: clinicalDocumentConstants.code.codeSystem,
        codeSystemName: clinicalDocumentConstants.code.codeSystemName,
        displayName: "NOTE-NAME", // TODO: Make this dynamic. IMPORTANT
      }),
      title: "NOTE-TITLE", // TODO: Make this dynamic. IMPORTANT
      effectiveTime: withNullFlavor(
        formatDateToCdaTimestamp(new Date().toISOString()),
        _valueAttribute
      ),
      confidentialityCode: buildCodeCe({
        code: clinicalDocumentConstants.confidentialityCode.code,
        codeSystem: clinicalDocumentConstants.confidentialityCode.codeSystem,
        displayName: clinicalDocumentConstants.confidentialityCode.displayName,
      }),
      languageCode: buildCodeCe({
        code: clinicalDocumentConstants.languageCode,
      }),
      setId: buildInstanceIdentifier({
        assigningAuthorityName: clinicalDocumentConstants.assigningAuthorityName,
        root: clinicalDocumentConstants.rootOid,
      }),
      versionNumber: withoutNullFlavorObject(
        clinicalDocumentConstants.versionNumber,
        _valueAttribute
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
    attributeNamePrefix: "_",
    // textNodeName: "#text",
    ignoreAttributes: false,
  });

  return builder.build(cleanedJsonObj);
}
