import { Composition } from "@medplum/fhirtypes";
import { buildDocumentId } from "../../../shareback/document-id";
import {
  CdaAuthor,
  CdaCodeCe,
  CdaCustodian,
  CdaRecordTarget,
  ClinicalDocument,
  EncompassingEncounter,
} from "../../cda-types/shared-types";
import {
  buildCodeCe,
  buildInstanceIdentifier,
  formatDateToCdaTimestamp,
  withNullFlavor,
  withoutNullFlavorObject,
} from "../commons";
import { clinicalDocumentConstants, _xmlnsSdtcAttribute, _xmlnsXsiAttribute } from "../constants";
import { xmlBuilder } from "./shared";

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

/**
 * @see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-ClinicalDocument.html
 */
export function buildClinicalDocumentXml({
  cxId,
  recordTarget,
  author,
  custodian,
  encompassingEncounter,
  structuredBody,
  composition,
  documentType = "ccd",
  patientId,
}: {
  cxId: string;
  recordTarget: CdaRecordTarget;
  author: CdaAuthor;
  custodian: CdaCustodian;
  encompassingEncounter: EncompassingEncounter | undefined;
  structuredBody: unknown;
  composition: Composition | undefined;
  documentType?: "ccd" | "progressNote";
  patientId: string;
}): string {
  const isCcd = documentType === "ccd";

  const documentTypeTemplateId = isCcd
    ? clinicalDocumentConstants.templateIds.ccd
    : clinicalDocumentConstants.templateIds.progressNote;

  const documentId = buildDocumentId(cxId, patientId, isCcd);

  const jsonObj: ClinicalDocument = {
    ClinicalDocument: {
      _xmlns: "urn:hl7-org:v3",
      [_xmlnsSdtcAttribute]: "urn:hl7-org:sdtc",
      [_xmlnsXsiAttribute]: "http://www.w3.org/2001/XMLSchema-instance",
      _moodCode: "EVN",
      realmCode: buildCodeCe({ code: clinicalDocumentConstants.realmCode }),
      typeId: buildInstanceIdentifier({
        extension: clinicalDocumentConstants.typeIdExtension,
        root: clinicalDocumentConstants.typeIdRoot,
      }),
      templateId: [clinicalDocumentConstants.templateIds.usRealmHeader, documentTypeTemplateId].map(
        tid =>
          buildInstanceIdentifier({
            root: tid.root,
            extension: tid.extension,
          })
      ),
      id: buildInstanceIdentifier({
        assigningAuthorityName: clinicalDocumentConstants.assigningAuthorityName,
        root: documentId,
      }),
      code: getDocumentTypeCode(composition),
      title: getDocumentTitle(composition),
      effectiveTime: withNullFlavor(formatDateToCdaTimestamp(new Date().toISOString()), "_value"),
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
      versionNumber: withoutNullFlavorObject(clinicalDocumentConstants.versionNumber, "_value"),
      recordTarget,
      author,
      custodian,
      componentOf: encompassingEncounter,
      component: structuredBody,
    },
  };
  const cleanedJsonObj = removeEmptyFields(jsonObj);
  return xmlBuilder.build(cleanedJsonObj);
}

function getDocumentTypeCode(composition: Composition | undefined): CdaCodeCe {
  if (composition && composition.type?.coding) {
    const primaryCoding = composition.type?.coding[0];
    return buildCodeCe({
      code: primaryCoding?.code,
      codeSystem: clinicalDocumentConstants.code.codeSystem,
      codeSystemName: clinicalDocumentConstants.code.codeSystemName,
      displayName: primaryCoding?.display,
    });
  }
  return buildCodeCe({
    code: "34133-9",
    codeSystem: clinicalDocumentConstants.code.codeSystem,
    codeSystemName: clinicalDocumentConstants.code.codeSystemName,
    displayName: "Summarization of Episode Note",
  });
}

function getDocumentTitle(composition: Composition | undefined): string {
  if (composition) {
    if (composition.title) {
      return composition.title;
    }
    if (composition.type?.text) {
      return composition.type?.text;
    }
  }
  return "Continuity of Care Document";
}
