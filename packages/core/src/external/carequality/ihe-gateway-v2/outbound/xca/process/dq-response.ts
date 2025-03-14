import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {
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
  XDSDocumentEntryUniqueId,
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

dayjs.extend(utc);

const { log } = out("DQ Processing");

function getResponseHomeCommunityId(extrinsicObject: ExtrinsicObject): string {
  return stripUrnPrefix(extrinsicObject?._home);
}

function getHomeCommunityIdForDr(extrinsicObject: ExtrinsicObject): string {
  return getResponseHomeCommunityId(extrinsicObject);
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

  const findSlotValue = (name: string): string | undefined => {
    const slot = slots.find((slot: Slot) => slot._name === name);
    return getSlotValue(slot);
  };

  const findExternalIdentifierValue = (scheme: string): string | undefined => {
    const identifier = externalIdentifiers?.find(
      (identifier: ExternalIdentifier) => identifier._identificationScheme === scheme
    );
    return identifier ? identifier._value : undefined;
  };

  const findClassificationSlotValue = (
    classificationScheme: string,
    slotName: string
  ): string | undefined => {
    const classification = classifications.find(
      (c: Classification) => c._classificationScheme === classificationScheme
    );
    if (!classification) return undefined;

    const slotArray = toArray(classification.Slot);
    const classificationSlots = slotArray.flatMap((slot: Slot) => slot ?? []);

    const slot = classificationSlots.find((s: Slot) => s._name === slotName);
    return getSlotValue(slot);
  };

  const findClassificationName = (scheme: string): string | undefined => {
    const classification = classifications?.find(
      (classification: Classification) => classification?._classificationScheme === scheme
    );
    if (!classification) return undefined;
    const title = getNameValue(classification?.Name);
    return title;
  };

  const sizeValue = findSlotValue("size");
  const repositoryUniqueId = findSlotValue("repositoryUniqueId");
  const docUniqueId = findExternalIdentifierValue(XDSDocumentEntryUniqueId);

  if (!docUniqueId) {
    const msg = "Document Reference is missing docUniqueId";
    capture.message(msg, {
      extra: {
        extrinsicObject,
        outboundRequest,
      },
      level: "warning",
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
    authorInstitution: findClassificationSlotValue(XDSDocumentEntryAuthor, "authorInstitution"),
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
