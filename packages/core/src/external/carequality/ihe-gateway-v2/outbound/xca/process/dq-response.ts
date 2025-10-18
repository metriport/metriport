import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {
  Coding,
  DocumentReference,
  OutboundDocumentQueryReq,
  OutboundDocumentQueryResp,
  XCAGateway,
} from "@metriport/ihe-gateway-sdk";
import { toArray } from "@metriport/shared";
import { createXMLParser } from "@metriport/shared/common/xml-parser";
import {
  XDSDocumentEntryAuthor,
  XDSDocumentEntryClassCode,
  XDSDocumentEntryConfidentialityCode,
  XDSDocumentEntryFormatCode,
  XDSDocumentEntryHealthcareFacilityTypeCode,
  XDSDocumentEntryPracticeSettingCode,
  XDSDocumentEntryTypeCode,
  XDSDocumentEntryUniqueId,
  LOINC_CODE,
  SNOMED_CODE,
  DEFAULT_FORMAT_CODE_SYSTEM,
  CONFIDENTIALITY_CODE_SYSTEM,
} from "../../../../../../shareback/metadata/constants";
import { errorToString } from "../../../../../../util/error/shared";
import { out } from "../../../../../../util/log";
import { capture } from "../../../../../../util/notifications";
import { stripUrnPrefix } from "../../../../../../util/urn";
import { Slot } from "../../../schema";
import { DQSamlClientResponse } from "../send/dq-requests";
import { partialSuccessStatus, successStatus } from "./constants";
import {
  handleEmptyResponse,
  handleHttpErrorResponse,
  handleRegistryErrorResponse,
  handleSchemaErrorResponse,
} from "./error";
import { Classification, ExternalIdentifier, ExtrinsicObject, iti38Schema } from "./schema";
import { getNameValue, getSlotValue } from "../../../utils";
import { codingSchema } from "@metriport/ihe-gateway-sdk/models/shared";

dayjs.extend(utc);

const { log } = out("DQ Processing");

const CODE_SYSTEM_OID_TO_URI: Record<string, string> = {
  [LOINC_CODE]: "http://loinc.org",
  [SNOMED_CODE]: "http://snomed.info/sct",
  [CONFIDENTIALITY_CODE_SYSTEM]: `urn:oid:${CONFIDENTIALITY_CODE_SYSTEM}`,
  [DEFAULT_FORMAT_CODE_SYSTEM]: `urn:oid:${DEFAULT_FORMAT_CODE_SYSTEM}`,
};

function getResponseHomeCommunityId(extrinsicObject: ExtrinsicObject): string {
  return stripUrnPrefix(extrinsicObject?._home);
}

function getHomeCommunityIdForDr(extrinsicObject: ExtrinsicObject): string {
  return getResponseHomeCommunityId(extrinsicObject);
}

function getTimeSafe(timeValue: string | undefined): string | undefined {
  try {
    return timeValue ? dayjs.utc(timeValue).toISOString() : undefined;
  } catch (error) {
    return undefined;
  }
}

function getCreationTime({
  creationTimeValue,
  serviceStartTimeValue,
  serviceStopTimeValue,
}: {
  creationTimeValue: string | undefined;
  serviceStartTimeValue: string | undefined;
  serviceStopTimeValue: string | undefined;
}): string | undefined {
  const time = creationTimeValue ?? serviceStartTimeValue ?? serviceStopTimeValue;

  try {
    return time ? dayjs.utc(time).toISOString() : undefined;
  } catch (error) {
    return undefined;
  }
}

function getCodeSystemForScheme(classificationScheme: string): string | undefined {
  const schemeToOidMap: Record<string, string> = {
    [XDSDocumentEntryClassCode]: LOINC_CODE,
    [XDSDocumentEntryTypeCode]: LOINC_CODE,
    [XDSDocumentEntryFormatCode]: DEFAULT_FORMAT_CODE_SYSTEM,
    [XDSDocumentEntryConfidentialityCode]: CONFIDENTIALITY_CODE_SYSTEM,
    [XDSDocumentEntryPracticeSettingCode]: SNOMED_CODE,
    [XDSDocumentEntryHealthcareFacilityTypeCode]: SNOMED_CODE,
  };
  const oid = schemeToOidMap[classificationScheme];
  return oid ? CODE_SYSTEM_OID_TO_URI[oid] : undefined;
}

export function parseDocumentReference({
  extrinsicObject,
  outboundRequest,
}: {
  extrinsicObject: ExtrinsicObject;
  outboundRequest: OutboundDocumentQueryReq;
}): DocumentReference | undefined {
  const slots = Array.isArray(extrinsicObject?.Slot)
    ? extrinsicObject?.Slot
    : [extrinsicObject?.Slot];
  const externalIdentifiers = Array.isArray(extrinsicObject?.ExternalIdentifier)
    ? extrinsicObject?.ExternalIdentifier
    : [extrinsicObject?.ExternalIdentifier];
  const classifications = Array.isArray(extrinsicObject?.Classification)
    ? extrinsicObject?.Classification
    : [extrinsicObject?.Classification];

  function findSlotValue(name: string): string | undefined {
    const slot = slots.find((slot: Slot) => slot._name === name);
    return getSlotValue(slot);
  }

  function findExternalIdentifierValue(scheme: string): string | undefined {
    const identifier = externalIdentifiers?.find(
      (identifier: ExternalIdentifier) => identifier._identificationScheme === scheme
    );
    return identifier ? identifier._value : undefined;
  }

  function findClassificationSlotValue(
    classificationScheme: string,
    slotName: string
  ): string | undefined {
    const classification = classifications.find(
      (c: Classification) => c._classificationScheme === classificationScheme
    );
    if (!classification) return undefined;

    const slotArray = toArray(classification.Slot);
    const classificationSlots = slotArray.flatMap((slot: Slot) => slot ?? []);

    const slot = classificationSlots.find((s: Slot) => s._name === slotName);
    return getSlotValue(slot);
  }

  function findClassificationName(scheme: string): string | undefined {
    const classification = classifications?.find(
      (classification: Classification) => classification?._classificationScheme === scheme
    );
    if (!classification) return undefined;
    const title = getNameValue(classification?.Name);
    return title;
  }

  function findClassificationCoding(classificationScheme: string): Coding | undefined {
    const classification = classifications.find(
      (c: Classification) => c._classificationScheme === classificationScheme
    );
    if (!classification) return undefined;

    const code = classification._nodeRepresentation;
    const display = getNameValue(classification.Name);
    const system = getCodeSystemForScheme(classificationScheme);

    if (!code && !display) return undefined;

    const result = codingSchema.safeParse({
      system,
      code,
      display,
    });

    if (!result.success) {
      log(`Could not parse coding for classification ${classificationScheme}`);
      return undefined;
    }

    return result.data;
  }

  const sizeValue = findSlotValue("size");
  const repositoryUniqueId = findSlotValue("repositoryUniqueId");
  const docUniqueId = findExternalIdentifierValue(XDSDocumentEntryUniqueId);

  if (!docUniqueId) {
    const msg = "Document Reference is missing docUniqueId";
    capture.error(msg, {
      extra: {
        extrinsicObject,
        outboundRequest,
      },
    });
    return undefined;
  }

  const creationTimeValue = findSlotValue("creationTime");
  const serviceStartTimeValue = findSlotValue("serviceStartTime");
  const serviceStopTimeValue = findSlotValue("serviceStopTime");

  const homeCommunityId = getHomeCommunityIdForDr(extrinsicObject);

  const documentReference: DocumentReference = {
    homeCommunityId,
    repositoryUniqueId: repositoryUniqueId ?? homeCommunityId,
    docUniqueId: stripUrnPrefix(docUniqueId),
    contentType: extrinsicObject?._mimeType,
    language: findSlotValue("languageCode"),
    size: sizeValue ? parseInt(sizeValue) : undefined,
    title: findClassificationName(XDSDocumentEntryClassCode),
    creation: getCreationTime({ creationTimeValue, serviceStartTimeValue, serviceStopTimeValue }),
    serviceStartTime: getTimeSafe(serviceStartTimeValue),
    serviceStopTime: getTimeSafe(serviceStopTimeValue),
    authorPerson: findClassificationSlotValue(XDSDocumentEntryAuthor, "authorPerson"),
    authorInstitution: findClassificationSlotValue(XDSDocumentEntryAuthor, "authorInstitution"),
    classCoding: findClassificationCoding(XDSDocumentEntryClassCode),
    typeCoding: findClassificationCoding(XDSDocumentEntryTypeCode),
    formatCoding: findClassificationCoding(XDSDocumentEntryFormatCode),
    confidentialityCoding: findClassificationCoding(XDSDocumentEntryConfidentialityCode),
    practiceSettingCoding: findClassificationCoding(XDSDocumentEntryPracticeSettingCode),
    healthcareFacilityTypeCoding: findClassificationCoding(
      XDSDocumentEntryHealthcareFacilityTypeCode
    ),
  };
  return documentReference;
}

function handleSuccessResponse({
  extrinsicObjects,
  outboundRequest,
  gateway,
}: {
  extrinsicObjects: ExtrinsicObject[];
  outboundRequest: OutboundDocumentQueryReq;
  gateway: XCAGateway;
}): OutboundDocumentQueryResp {
  const documentReferences = extrinsicObjects.flatMap(
    extrinsicObject => parseDocumentReference({ extrinsicObject, outboundRequest }) ?? []
  );

  const response: OutboundDocumentQueryResp = {
    id: outboundRequest.id,
    patientId: outboundRequest.patientId,
    timestamp: outboundRequest.timestamp,
    requestTimestamp: outboundRequest.timestamp,
    responseTimestamp: dayjs().toISOString(),
    gateway,
    documentReference: documentReferences,
    externalGatewayPatient: outboundRequest.externalGatewayPatient,
    iheGatewayV2: true,
  };
  return response;
}

export function processDqResponse({
  response: { response, success, gateway, outboundRequest },
}: {
  response: DQSamlClientResponse;
}): OutboundDocumentQueryResp {
  if (success === false) {
    return handleHttpErrorResponse({
      httpError: response,
      outboundRequest,
      gateway: gateway,
    });
  }
  const parser = createXMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    textNodeName: "_text",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });
  const jsonObj = parser.parse(response);

  try {
    const iti38Response = iti38Schema.parse(jsonObj);

    const status = iti38Response.Envelope.Body.AdhocQueryResponse._status.split(":").pop();
    const registryObjectList = iti38Response.Envelope.Body.AdhocQueryResponse.RegistryObjectList;
    const extrinsicObjects = registryObjectList ? registryObjectList.ExtrinsicObject : undefined;
    const registryErrorList = iti38Response.Envelope.Body.AdhocQueryResponse?.RegistryErrorList;

    if ((status === successStatus || status === partialSuccessStatus) && extrinsicObjects) {
      return handleSuccessResponse({
        extrinsicObjects: toArray(extrinsicObjects),
        outboundRequest,
        gateway,
      });
    } else if (registryErrorList) {
      return handleRegistryErrorResponse({
        registryErrorList,
        outboundRequest,
        gateway,
      });
    } else {
      return handleEmptyResponse({
        outboundRequest,
        gateway,
      });
    }
  } catch (error) {
    log(`Error processing DQ response ${JSON.stringify(jsonObj)}`);
    return handleSchemaErrorResponse({
      outboundRequest,
      gateway,
      text: errorToString(error),
    });
  }
}
