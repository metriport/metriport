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

  const metadataXml = `<ExtrinsicObject home="${METRIPORT_HOME_COMMUNITY_ID}" id="${documentUUID}" isOpaque="false" mimeType="text/xml" objectType="urn:uuid:34268e47-fdf5-41a6-ba33-82133c465248" status="urn:oasis:names:tc:ebxml-regrep:StatusType:Approved">

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
    
    <Classification classificationScheme="urn:uuid:41a5887f-8865-4c09-adf7-e362475b143a" classifiedObject="${documentUUID}" id="${uuidv7()}" nodeRepresentation="${classCodeNode}" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
      <Slot name="codingScheme">
        <ValueList>
          <Value>${LOINC_CODE}</Value>
        </ValueList>
      </Slot>
      <Name>
        <LocalizedString charset="UTF-8" value="${classCodeDisplay}"/>
      </Name>
    </Classification>
    
    <Classification classificationScheme="urn:uuid:f4f85eac-e6cb-4883-b524-f2705394840f" classifiedObject="${documentUUID}" id="${uuidv7()}" nodeRepresentation="${DEFAULT_CONFIDENTIALITY_CODE}" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
      <Slot name="codingScheme">
        <ValueList>
          <Value>${CONFIDENTIALITY_CODE_SYSTEM}</Value>
        </ValueList>
      </Slot>
      <Name>
        <LocalizedString charset="UTF-8" value="Normal"/>
      </Name>
    </Classification>
    
    <Classification classificationScheme="urn:uuid:a09d5840-386c-46f2-b5ad-9c3699a4309d" classifiedObject="${documentUUID}" id="${uuidv7()}" nodeRepresentation="${DEFAULT_FORMAT_CODE_NODE}" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
      <Slot name="codingScheme">
        <ValueList>
          <Value>${DEFAULT_FORMAT_CODE_SYSTEM}</Value>
        </ValueList>
      </Slot>
      <Name>
        <LocalizedString charset="UTF-8" value="${classCodeDisplay}"/>
      </Name>
    </Classification>
    
    <Classification classificationScheme="urn:uuid:cccf5598-8b07-4b77-a05e-ae952c785ead" classifiedObject="${documentUUID}" id="${uuidv7()}" nodeRepresentation="${practiceSettingCodeNode}" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
      <Slot name="codingScheme">
        <ValueList>
          <Value>${SNOMED_CODE}</Value>
        </ValueList>
      </Slot>
      <Name>
        <LocalizedString charset="UTF-8" value="${practiceSettingCodeDisplay}"/>
      </Name>
    </Classification>
    
    <Classification classificationScheme="urn:uuid:f0306f51-975f-434e-a61c-c59651d33983" classifiedObject="${documentUUID}" id="${uuidv7()}" nodeRepresentation="${classCodeNode}" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
      <Slot name="codingScheme">
        <ValueList>
          <Value>${LOINC_CODE}</Value>
        </ValueList>
      </Slot>
      <Name>
        <LocalizedString charset="UTF-8" value="${classCodeDisplay}"/>
      </Name>
    </Classification>
    
    <Classification classificationScheme="urn:uuid:f33fb8ac-18af-42cc-ae0e-ed0b0bdb91e1" classifiedObject="${documentUUID}" id="${uuidv7()}" nodeRepresentation="${healthcareFacilityTypeCodeNode}" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
      <Slot name="codingScheme">
        <ValueList>
          <Value>${SNOMED_CODE}</Value>
        </ValueList>
      </Slot>
      <Name>
        <LocalizedString charset="UTF-8" value="${healthcareFacilityTypeCodeDisplay}"/>
      </Name>
    </Classification>
    
    <ExternalIdentifier id="${uuidv7()}" identificationScheme="urn:uuid:58a6f841-87b3-4a3e-92fd-a8ffeff98427" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:ExternalIdentifier" registryObject="${documentUUID}" value="${patientId}^^^&amp;${homeCommunityId}&amp;ISO">
      <Name>
        <LocalizedString charset="UTF-8" value="XDSDocumentEntry.patientId"/>
      </Name>
    </ExternalIdentifier>
    
    <!-- (IHE) REQUIRED - DocumentEntry.uniqueId - Globally unique identifier assigned to the document by its creator -->
    <ExternalIdentifier id="${uuidv7()}" identificationScheme="urn:uuid:2e82c1f6-a085-4c72-9da3-8640a32e42ab" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:ExternalIdentifier" registryObject="${documentUUID}" value="${createDocumentUniqueId(
    documentUniqueId
  )}">
      <Name>
        <LocalizedString charset="UTF-8" value="XDSDocumentEntry.uniqueId"/>
      </Name>
    </ExternalIdentifier>
  </ExtrinsicObject>`;
  return metadataXml;
}
