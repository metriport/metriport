import { XMLBuilder } from "fast-xml-parser";
import {
  buildCodeCE,
  buildInstanceIdentifier,
  withNullFlavor,
  withoutNullFlavorObject,
} from "../commons";
import { clinicalDocumentConstants, valueAttribute } from "../constants";
import {
  CDAAuthor,
  CDACustodian,
  CDARecordTarget,
  ClinicalDocument,
} from "../../cda-types/shared-types";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function removeEmptyFields(obj: any): unknown {
  if (typeof obj === "object" && obj !== undefined) {
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
export function buildClinicalDocumentXML(
  recordTarget: CDARecordTarget,
  author: CDAAuthor,
  custodian: CDACustodian,
  structuredBody: unknown
): string {
  const jsonObj: ClinicalDocument = {
    ClinicalDocument: {
      "@_xmlns": "urn:hl7-org:v3",
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
        root: clinicalDocumentConstants.idRoot,
      }),
      code: buildCodeCE({
        code: clinicalDocumentConstants.code.code,
        codeSystem: clinicalDocumentConstants.code.codeSystem,
        codeSystemName: clinicalDocumentConstants.code.codeSystemName,
        displayName: clinicalDocumentConstants.code.displayName,
      }),
      title: clinicalDocumentConstants.title,
      effectiveTime: withNullFlavor(clinicalDocumentConstants.effectiveTime, valueAttribute),
      confidentialityCode: buildCodeCE({
        code: clinicalDocumentConstants.confidentialityCode.code,
        codeSystem: clinicalDocumentConstants.confidentialityCode.codeSystem,
        displayName: clinicalDocumentConstants.confidentialityCode.displayName,
      }),
      languageCode: buildCodeCE({
        code: clinicalDocumentConstants.languageCode,
      }),
      setId: buildInstanceIdentifier({
        assigningAuthorityName: clinicalDocumentConstants.setId.assigningAuthorityName,
        extension: clinicalDocumentConstants.setId.extension,
        root: clinicalDocumentConstants.setId.root,
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

  const generatedXml = builder.build(cleanedJsonObj);
  return postProcessXml(generatedXml);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function postProcessXml(xml: any): string {
  return xml.replaceAll("<br>", "").replaceAll("</br>", "<br />");
}
