import { CodeableConcept, Organization } from "@medplum/fhirtypes";
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
  METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX,
  ORGANIZATION_NAME_DEFAULT,
  DEFAULT_TITLE,
  createDocumentUniqueId,
  XDSDocumentEntryAuthor,
  XDSDocumentEntryClassCode,
  XDSDocumentEntryUniqueId,
  XDSDocumentEntryConfidentialityCode,
  XDSDocumentEntryFormatCode,
  XDSDocumentEntryPracticeSettingCode,
  XDSDocumentEntryHealthcareFacilityTypeCode,
  XDSDocumentEntryTypeCode,
  XDSDocumentEntryPatientId,
} from "../shared";
import { uuidv7 } from "../../../util/uuid-v7";

export function createExtrinsicObjectXml({
  createdTime,
  organization,
  size,
  patientId,
  classCode,
  practiceSettingCode,
  healthcareFacilityTypeCode,
  documentUniqueId,
  title,
  mimeType,
}: {
  createdTime: string;
  size: string;
  patientId: string;
  organization: Organization | undefined;
  classCode?: CodeableConcept | undefined;
  practiceSettingCode?: CodeableConcept | undefined;
  healthcareFacilityTypeCode?: CodeableConcept | undefined;
  documentUniqueId: string;
  title?: string | undefined;
  mimeType: string;
}) {
  const documentUUID = uuidv7();
  const classCodeNode = classCode?.coding?.[0]?.code || DEFAULT_CLASS_CODE_NODE;
  const practiceSettingCodeNode =
    practiceSettingCode?.coding?.[0]?.code || DEFAULT_PRACTICE_SETTING_CODE_NODE;
  const practiceSettingCodeDisplay =
    practiceSettingCode?.coding?.[0]?.display ||
    practiceSettingCode?.text ||
    DEFAULT_PRACTICE_SETTING_CODE_DISPLAY;
  const healthcareFacilityTypeCodeNode =
    healthcareFacilityTypeCode?.coding?.[0]?.code || DEFAULT_HEALTHCARE_FACILITY_TYPE_CODE_NODE;

  const organizationName = organization?.name || ORGANIZATION_NAME_DEFAULT;
  const organizationId =
    organization?.identifier?.find(identifier =>
      identifier.value?.startsWith(METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX)
    )?.value || METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX;

  const stableDocumentId = "urn:uuid:7edca82f-054d-47f2-a032-9b2a5b5186c1";

  const metadataXml = `<ExtrinsicObject xmlns="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0" home="${METRIPORT_HOME_COMMUNITY_ID}" id="${documentUUID}" isOpaque="false" mimeType="${mimeType}" objectType="${stableDocumentId}" status="urn:oasis:names:tc:ebxml-regrep:StatusType:Approved">

    <Slot name="creationTime">
      <ValueList>
        <Value>${createdTime}</Value>
      </ValueList>
    </Slot>

    <Slot name="serviceStartTime">
      <ValueList>
        <Value>${createdTime}</Value>
      </ValueList>
    </Slot>
    
    <Slot name="languageCode">
      <ValueList>
        <Value>en-US</Value>
      </ValueList>
    </Slot>
    
    <Slot name="repositoryUniqueId">
      <ValueList>
        <Value>${METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX}</Value>
      </ValueList>
    </Slot>
    
    <Slot name="size">
      <ValueList>
        <Value>${size}</Value>
      </ValueList>
    </Slot>
    
    <Slot name="sourcePatientId">
      <ValueList>
        <Value>${patientId}^^^&amp;${METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX}&amp;ISO</Value>
      </ValueList>
    </Slot>
    
    <Name>
      <LocalizedString charset="UTF-8" value="${title ? title : DEFAULT_TITLE}"/>
    </Name>

    <Classification classificationScheme="${XDSDocumentEntryAuthor}" classifiedObject="urn:uuid:00000000-0000-d6ba-5161-4e497785491d" id="urn:uuid:953e825d-3907-497c-8a95-bc3761e2a642" nodeRepresentation="" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
      <Slot name="authorPerson">
        <ValueList>
          <Value>${organizationName}^^^^^^^&amp;${organizationId}&amp;ISO</Value>
        </ValueList>
      </Slot>
      <Slot name="authorInstitution">
        <ValueList>
          <Value>${organizationName}^^^^^^^^^${organizationId}</Value>
        </ValueList>
      </Slot>
    </Classification>
    
    <Classification classificationScheme="${XDSDocumentEntryClassCode}" classifiedObject="${documentUUID}" id="${uuidv7()}" nodeRepresentation="${DEFAULT_CLASS_CODE_NODE}" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
      <Slot name="codingScheme">
        <ValueList>
          <Value>${LOINC_CODE}</Value>
        </ValueList>
      </Slot>
      <Name>
        <LocalizedString charset="UTF-8" value="${DEFAULT_CLASS_CODE_DISPLAY}"/>
      </Name>
    </Classification>
    
    <Classification classificationScheme="${XDSDocumentEntryConfidentialityCode}" classifiedObject="${documentUUID}" id="${uuidv7()}" nodeRepresentation="${DEFAULT_CONFIDENTIALITY_CODE}" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
      <Slot name="codingScheme">
        <ValueList>
          <Value>${CONFIDENTIALITY_CODE_SYSTEM}</Value>
        </ValueList>
      </Slot>
      <Name>
        <LocalizedString charset="UTF-8" value="Normal"/>
      </Name>
    </Classification>
    
    <Classification classificationScheme="${XDSDocumentEntryFormatCode}" classifiedObject="${documentUUID}" id="${uuidv7()}" nodeRepresentation="${DEFAULT_FORMAT_CODE_NODE}" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
      <Slot name="codingScheme">
        <ValueList>
          <Value>${DEFAULT_FORMAT_CODE_SYSTEM}</Value>
        </ValueList>
      </Slot>
      <Name>
        <LocalizedString charset="UTF-8" value="${DEFAULT_CLASS_CODE_DISPLAY}"/>
      </Name>
    </Classification>
    
    <Classification classificationScheme="${XDSDocumentEntryPracticeSettingCode}" classifiedObject="${documentUUID}" id="${uuidv7()}" nodeRepresentation="${practiceSettingCodeNode}" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
      <Slot name="codingScheme">
        <ValueList>
          <Value>${SNOMED_CODE}</Value>
        </ValueList>
      </Slot>
      <Name>
        <LocalizedString charset="UTF-8" value="${practiceSettingCodeDisplay}"/>
      </Name>
    </Classification>

    <Classification classificationScheme="${XDSDocumentEntryHealthcareFacilityTypeCode}" classifiedObject="${documentUUID}" id="${uuidv7()}" nodeRepresentation="${healthcareFacilityTypeCodeNode}" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
      <Slot name="codingScheme">
        <ValueList>
          <Value>${SNOMED_CODE}</Value>
        </ValueList>
      </Slot>
      <Name>
        <LocalizedString charset="UTF-8" value="${DEFAULT_HEALTHCARE_FACILITY_TYPE_CODE_DISPLAY}"/>
      </Name>
    </Classification>
    
    <Classification classificationScheme="${XDSDocumentEntryTypeCode}" classifiedObject="${documentUUID}" id="${uuidv7()}" nodeRepresentation="${classCodeNode}" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
      <Slot name="codingScheme">
        <ValueList>
          <Value>${LOINC_CODE}</Value>
        </ValueList>
      </Slot>
      <Name>
        <LocalizedString charset="UTF-8" value="${DEFAULT_CLASS_CODE_DISPLAY}"/>
      </Name>
    </Classification>
    
    <ExternalIdentifier id="${uuidv7()}" identificationScheme="${XDSDocumentEntryPatientId}" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:ExternalIdentifier" registryObject="${documentUUID}" value="${patientId}^^^&amp;${METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX}&amp;ISO">
      <Name>
        <LocalizedString charset="UTF-8" value="XDSDocumentEntry.patientId"/>
      </Name>
    </ExternalIdentifier>
    
    <ExternalIdentifier id="${uuidv7()}" identificationScheme="${XDSDocumentEntryUniqueId}" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:ExternalIdentifier" registryObject="${documentUUID}" value="${createDocumentUniqueId(
    documentUniqueId
  )}">
      <Name>
        <LocalizedString charset="UTF-8" value="XDSDocumentEntry.uniqueId"/>
      </Name>
    </ExternalIdentifier>
  </ExtrinsicObject>`;
  return metadataXml;
}
