import { CodeableConcept, Organization } from "@medplum/fhirtypes";
import {
  ON_DEMAND_DOCUMENT_TYPE_UUID,
  STABLE_DOCUMENT_TYPE_UUID,
} from "@metriport/ihe-gateway-sdk";
import {
  DEFAULT_TITLE,
  METRIPORT_HOME_COMMUNITY_ID,
  METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX,
  ORGANIZATION_NAME_DEFAULT,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { encodeToHtml } from "@metriport/shared/common/html";
import { formatPatientIdAsHl7v2Encoded } from "../../external/hie-shared/ids";
import { wrapIdInUrnUuid } from "../../util/urn";
import { uuidv7 } from "../../util/uuid-v7";
import { storeMappingAndEncodeDocumentId } from "../doc-id-mapping";
import { buildDocumentId } from "../document-id";
import { CCD_DOCUMENT_NAME } from "../file";
import {
  CONFIDENTIALITY_CODE_SYSTEM,
  DEFAULT_CLASS_CODE_DISPLAY,
  DEFAULT_CLASS_CODE_NODE,
  DEFAULT_CONFIDENTIALITY_CODE,
  DEFAULT_FORMAT_CODE_NODE,
  DEFAULT_FORMAT_CODE_SYSTEM,
  DEFAULT_HEALTHCARE_FACILITY_TYPE_CODE_DISPLAY,
  DEFAULT_HEALTHCARE_FACILITY_TYPE_CODE_NODE,
  DEFAULT_PRACTICE_SETTING_CODE_DISPLAY,
  DEFAULT_PRACTICE_SETTING_CODE_NODE,
  LOINC_CODE,
  SNOMED_CODE,
  XDSDocumentEntryAuthor,
  XDSDocumentEntryClassCode,
  XDSDocumentEntryConfidentialityCode,
  XDSDocumentEntryFormatCode,
  XDSDocumentEntryHealthcareFacilityTypeCode,
  XDSDocumentEntryPatientId,
  XDSDocumentEntryPracticeSettingCode,
  XDSDocumentEntryTypeCode,
  XDSDocumentEntryUniqueId,
} from "./constants";

export async function createMetadataXmlContents({
  cxId,
  patientId,
  encodedPatientId,
  createdTime,
  organization,
  size,
  classCode,
  practiceSettingCode,
  healthcareFacilityTypeCode,
  documentS3Key,
  title,
  mimeType,
  hash,
  isCcd,
}: {
  cxId: string;
  patientId: string;
  encodedPatientId: string;
  createdTime: string;
  size: string;
  organization: Organization | undefined;
  classCode?: CodeableConcept | undefined;
  practiceSettingCode?: CodeableConcept | undefined;
  healthcareFacilityTypeCode?: CodeableConcept | undefined;
  documentS3Key: string;
  title?: string | undefined;
  mimeType: string;
  hash: string;
  isCcd: boolean;
}): Promise<string> {
  const createdTimeInHl7Format = formatDateToHl7(createdTime);

  const documentUUID = buildDocumentId(cxId, patientId, isCcd);

  const encodedDocumentId = await storeMappingAndEncodeDocumentId({
    cxId,
    patientId,
    documentUuid: documentUUID,
    documentFullPath: documentS3Key,
  });

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
  const htmlSafeTitle = title ? encodeToHtml(title) : DEFAULT_CLASS_CODE_DISPLAY;

  const documentTypeId = getDocumentTypeUrnUuid(isCcd);

  const patientIdInHl7Format = formatPatientIdAsHl7v2Encoded({
    patientId: encodedPatientId,
    assignAuthority: METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX,
  });

  const metadataXml = `<ExtrinsicObject xmlns="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0" home="${METRIPORT_HOME_COMMUNITY_ID}" id="${documentUUID}" isOpaque="false" mimeType="${mimeType}" objectType="${documentTypeId}" status="urn:oasis:names:tc:ebxml-regrep:StatusType:Approved">

    <Slot name="creationTime">
      <ValueList>
        <Value>${createdTimeInHl7Format}</Value>
      </ValueList>
    </Slot>

    <Slot name="serviceStartTime">
      <ValueList>
        <Value>${createdTimeInHl7Format}</Value>
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

    <Slot name="hash">
      <ValueList>
        <Value>${hash}</Value>
      </ValueList>
    </Slot>

    <Slot name="sourcePatientId">
      <ValueList>
        <Value>${patientIdInHl7Format}</Value>
      </ValueList>
    </Slot>

    <Name>
      <LocalizedString charset="UTF-8" value="${title ? encodeToHtml(title) : DEFAULT_TITLE}"/>
    </Name>

    <Classification classificationScheme="${XDSDocumentEntryAuthor}" classifiedObject="${documentUUID}" id="urn:uuid:953e825d-3907-497c-8a95-bc3761e2a642" nodeRepresentation="" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
      <Slot name="authorPerson">
        <ValueList>
          <Value>${encodeToHtml(organizationName)}^^^^^^^&amp;${organizationId}&amp;ISO</Value>
        </ValueList>
      </Slot>
      <Slot name="authorInstitution">
        <ValueList>
          <Value>${encodeToHtml(organizationName)}^^^^^^^^^${organizationId}</Value>
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
        <LocalizedString charset="UTF-8" value="${htmlSafeTitle}"/>
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
        <LocalizedString charset="UTF-8" value="${htmlSafeTitle}"/>
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
        <LocalizedString charset="UTF-8" value="${htmlSafeTitle}"/>
      </Name>
    </Classification>

    <ExternalIdentifier id="${uuidv7()}" identificationScheme="${XDSDocumentEntryPatientId}" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:ExternalIdentifier" registryObject="${documentUUID}" value="${patientIdInHl7Format}">
      <Name>
        <LocalizedString charset="UTF-8" value="XDSDocumentEntry.patientId"/>
      </Name>
    </ExternalIdentifier>

    <ExternalIdentifier id="${uuidv7()}" identificationScheme="${XDSDocumentEntryUniqueId}" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:ExternalIdentifier" registryObject="${documentUUID}" value="${encodedDocumentId}">
      <Name>
        <LocalizedString charset="UTF-8" value="XDSDocumentEntry.uniqueId"/>
      </Name>
    </ExternalIdentifier>
  </ExtrinsicObject>`;
  return metadataXml;
}

export function shouldCreateMetadataForFile(key: string): boolean {
  return key.endsWith(CCD_DOCUMENT_NAME);
}

function getDocumentTypeUrnUuid(isCcd: boolean): string {
  return isCcd
    ? wrapIdInUrnUuid(ON_DEMAND_DOCUMENT_TYPE_UUID)
    : wrapIdInUrnUuid(STABLE_DOCUMENT_TYPE_UUID);
}

function formatDateToHl7(createdTimestamp: string, format = "YYYYMMDDHHmmss"): string {
  return buildDayjs(createdTimestamp).utc().format(format);
}
