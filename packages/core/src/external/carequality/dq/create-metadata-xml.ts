import { CodeableConcept } from "@medplum/fhirtypes";
import {
  DEFAULT_CLASS_CODE_NODE,
  DEFAULT_CLASS_CODE_DISPLAY,
  DEFAULT_CONFIDENTIALITY_CODE,
  CONFIDENTIALITY_CODE_SYSTEM,
  LOINC_CODE,
  SNOMED_CODE,
  DEFAULT_FORMAT_CODE_SYSTEM,
  DEFAULT_FORMAT_CODE_NODE,
  DEFAULT_PRACTICE_SETTING_CODE_NODE,
  DEFAULT_PRACTICE_SETTING_CODE_DISPLAY,
  DEFAULT_HEALTHCARE_FACILITY_TYPE_CODE_NODE,
  DEFAULT_HEALTHCARE_FACILITY_TYPE_CODE_DISPLAY,
  METRIPORT_HOME_COMMUNITY_ID,
  ON_DEMAND_OBJECT_TYPE,
  CLASS_CODE_CLASSIFICATION_SCHEME,
  CONDIDENTIALITY_CODE_CLASSIFICATION_SCHEME,
  FORMAT_CODE_CLASSIFICATION_SCHEME,
  PRACTICE_SETTING_CODE_CLASSIFICATION_SCHEME,
  HEALTHCARE_FACILITY_TYPE_CODE_CLASSIFICATION_SCHEME,
  TYPE_CODE_CLASSIFICATION_SCHEME,
  PATIENT_ID_CLASSIFICATION_SCHEME,
  DOCUMENT_ENTRY_CLASSIFICATION_SCHEME,
  createDocumentUniqueId,
} from "../shared";
import { uuidv7 } from "../../../util/uuid-v7";

export function createExtrinsicObjectXml({
  createdTime,
  hash,
  repositoryUniqueId,
  homeCommunityId,
  size,
  patientId,
  classCode,
  practiceSettingCode,
  healthcareFacilityTypeCode,
  documentUniqueId,
  title,
}: {
  createdTime: string;
  hash: string;
  repositoryUniqueId: string;
  homeCommunityId: string;
  size: string;
  patientId: string;
  classCode?: CodeableConcept | undefined;
  practiceSettingCode?: CodeableConcept | undefined;
  healthcareFacilityTypeCode?: CodeableConcept | undefined;
  documentUniqueId: string;
  title?: string | undefined;
}) {
  const documentUUID = uuidv7();
  const classCodeNode = classCode?.coding?.[0]?.code || DEFAULT_CLASS_CODE_NODE;
  const classCodeDisplay =
    classCode?.coding?.[0]?.display || classCode?.text || DEFAULT_CLASS_CODE_DISPLAY;
  const practiceSettingCodeNode =
    practiceSettingCode?.coding?.[0]?.code || DEFAULT_PRACTICE_SETTING_CODE_NODE;
  const practiceSettingCodeDisplay =
    practiceSettingCode?.coding?.[0]?.display ||
    practiceSettingCode?.text ||
    DEFAULT_PRACTICE_SETTING_CODE_DISPLAY;
  const healthcareFacilityTypeCodeNode =
    healthcareFacilityTypeCode?.coding?.[0]?.code || DEFAULT_HEALTHCARE_FACILITY_TYPE_CODE_NODE;
  const healthcareFacilityTypeCodeDisplay =
    healthcareFacilityTypeCode?.coding?.[0]?.display ||
    healthcareFacilityTypeCode?.text ||
    DEFAULT_HEALTHCARE_FACILITY_TYPE_CODE_DISPLAY;

  const objectTypeClassification =
    "urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification";
  const externalIdentifierClassification =
    "urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:ExternalIdentifier";

  const metadataXml = `<ExtrinsicObject home="${METRIPORT_HOME_COMMUNITY_ID}" id="${documentUUID}" isOpaque="false" mimeType="text/xml" objectType="${ON_DEMAND_OBJECT_TYPE}" status="urn:oasis:names:tc:ebxml-regrep:StatusType:Approved">

    <Slot name="creationTime">
      <ValueList>
        <Value>${createdTime}</Value>
      </ValueList>
    </Slot>
  
    <Slot name="hash">
      <ValueList>
        <Value>${hash}</Value>
      </ValueList>
    </Slot>
    
    <Slot name="languageCode">
      <ValueList>
        <Value>en-US</Value>
      </ValueList>
    </Slot>
    
    <Slot name="repositoryUniqueId">
      <ValueList>
        <Value>${repositoryUniqueId}</Value>
      </ValueList>
    </Slot>
    
    <Slot name="size">
      <ValueList>
        <Value>${size}</Value>
      </ValueList>
    </Slot>
    
    <Slot name="sourcePatientId">
      <ValueList>
        <Value>${patientId}^^^&amp;${homeCommunityId}&amp;ISO</Value>
      </ValueList>
    </Slot>
    
    <Name>
      <LocalizedString charset="UTF-8" value="${title}"/>
    </Name>
    
    <Classification classificationScheme="${CLASS_CODE_CLASSIFICATION_SCHEME}" classifiedObject="${documentUUID}" id="${uuidv7()}" nodeRepresentation="${classCodeNode}" objectType="${objectTypeClassification}">
      <Slot name="codingScheme">
        <ValueList>
          <Value>${LOINC_CODE}</Value>
        </ValueList>
      </Slot>
      <Name>
        <LocalizedString charset="UTF-8" value="${classCodeDisplay}"/>
      </Name>
    </Classification>
    
    <Classification classificationScheme="${CONDIDENTIALITY_CODE_CLASSIFICATION_SCHEME}" classifiedObject="${documentUUID}" id="${uuidv7()}" nodeRepresentation="${DEFAULT_CONFIDENTIALITY_CODE}" objectType="${objectTypeClassification}">
      <Slot name="codingScheme">
        <ValueList>
          <Value>${CONFIDENTIALITY_CODE_SYSTEM}</Value>
        </ValueList>
      </Slot>
      <Name>
        <LocalizedString charset="UTF-8" value="Normal"/>
      </Name>
    </Classification>
    
    <Classification classificationScheme="${FORMAT_CODE_CLASSIFICATION_SCHEME}" classifiedObject="${documentUUID}" id="${uuidv7()}" nodeRepresentation="${DEFAULT_FORMAT_CODE_NODE}" objectType="${objectTypeClassification}">
      <Slot name="codingScheme">
        <ValueList>
          <Value>${DEFAULT_FORMAT_CODE_SYSTEM}</Value>
        </ValueList>
      </Slot>
      <Name>
        <LocalizedString charset="UTF-8" value="${classCodeDisplay}"/>
      </Name>
    </Classification>
    
    <Classification classificationScheme="${PRACTICE_SETTING_CODE_CLASSIFICATION_SCHEME}" classifiedObject="${documentUUID}" id="${uuidv7()}" nodeRepresentation="${practiceSettingCodeNode}" objectType="${objectTypeClassification}">
      <Slot name="codingScheme">
        <ValueList>
          <Value>${SNOMED_CODE}</Value>
        </ValueList>
      </Slot>
      <Name>
        <LocalizedString charset="UTF-8" value="${practiceSettingCodeDisplay}"/>
      </Name>
    </Classification>
    
    <Classification classificationScheme="${TYPE_CODE_CLASSIFICATION_SCHEME}" classifiedObject="${documentUUID}" id="${uuidv7()}" nodeRepresentation="${classCodeNode}" objectType="${objectTypeClassification}">
      <Slot name="codingScheme">
        <ValueList>
          <Value>${LOINC_CODE}</Value>
        </ValueList>
      </Slot>
      <Name>
        <LocalizedString charset="UTF-8" value="${classCodeDisplay}"/>
      </Name>
    </Classification>
    
    <Classification classificationScheme="${HEALTHCARE_FACILITY_TYPE_CODE_CLASSIFICATION_SCHEME}" classifiedObject="${documentUUID}" id="${uuidv7()}" nodeRepresentation="${healthcareFacilityTypeCodeNode}" objectType="${objectTypeClassification}">
      <Slot name="codingScheme">
        <ValueList>
          <Value>${SNOMED_CODE}</Value>
        </ValueList>
      </Slot>
      <Name>
        <LocalizedString charset="UTF-8" value="${healthcareFacilityTypeCodeDisplay}"/>
      </Name>
    </Classification>
    
    <ExternalIdentifier id="${uuidv7()}" identificationScheme="${PATIENT_ID_CLASSIFICATION_SCHEME}" objectType=""${externalIdentifierClassification}"}" registryObject="${documentUUID}" value="${patientId}^^^&amp;${homeCommunityId}&amp;ISO">
      <Name>
        <LocalizedString charset="UTF-8" value="XDSDocumentEntry.patientId"/>
      </Name>
    </ExternalIdentifier>
    
    <!-- (IHE) REQUIRED - DocumentEntry.uniqueId - Globally unique identifier assigned to the document by its creator -->
    <ExternalIdentifier id="${uuidv7()}" identificationScheme="${DOCUMENT_ENTRY_CLASSIFICATION_SCHEME}" objectType=""${externalIdentifierClassification}"}" registryObject="${documentUUID}" value="${createDocumentUniqueId(
    documentUniqueId
  )}">
      <Name>
        <LocalizedString charset="UTF-8" value="XDSDocumentEntry.uniqueId"/>
      </Name>
    </ExternalIdentifier>
  </ExtrinsicObject>`;
  return metadataXml;
}
