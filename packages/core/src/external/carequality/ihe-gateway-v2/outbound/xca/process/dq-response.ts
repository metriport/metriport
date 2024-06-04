import { XMLParser } from "fast-xml-parser";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import {
  OutboundDocumentQueryReq,
  OutboundDocumentQueryResp,
  DocumentReference,
  XCAGateway,
} from "@metriport/ihe-gateway-sdk";
import { handleRegistryErrorResponse, handleHttpErrorResponse, handleEmptyResponse } from "./error";
import { DQSamlClientResponse } from "../send/dq-requests";
import { stripUrnPrefix } from "../../../../../../util/urn";
import {
  XDSDocumentEntryAuthor,
  XDSDocumentEntryClassCode,
  XDSDocumentEntryUniqueId,
} from "../../../../shared";
import { successStatus, partialSuccessStatus } from "./constants";
import { capture } from "../../../../../../util/notifications";

dayjs.extend(customParseFormat);

type Identifier = {
  _identificationScheme: string;
  _value: string;
};

type Classification = {
  _classificationScheme: string;
  Name: {
    LocalizedString: {
      _charset: string;
      _value: string;
    };
  };
};

type Slot = {
  _name: string;
  ValueList: {
    Value: string | string[];
  };
};

function getResponseHomeCommunityId(
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  extrinsicObject: any
): string {
  return stripUrnPrefix(extrinsicObject?._home);
}

export function parseCreationTime(created: string): string | undefined {
  try {
    const isValidISO = dayjs(created, "YYYY-MM-DDTHH:mm:ss", true).isValid();
    const isValid1 = dayjs(created, "YYYY-MM-DD", true).isValid();
    const isValid2 = dayjs(created, "YYYYMMDDHHmmss", true).isValid();
    const isValid3 = dayjs(created, "YYYYMMDD", true).isValid();

    if (isValidISO) {
      return created;
    } else if (isValid1) {
      return dayjs(created, "YYYY-MM-DD").format("YYYY-MM-DDTHH:mm:ss");
    } else if (isValid2) {
      return dayjs(created, "YYYYMMDDHHmmss").format("YYYY-MM-DDTHH:mm:ss");
    } else if (isValid3) {
      return dayjs(created, "YYYYMMDD").format("YYYY-MM-DDTHH:mm:ss");
    }
    return undefined;
  } catch (ex) {
    return undefined;
  }
}

function getHomeCommunityIdForDr(
  request: OutboundDocumentQueryReq,
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  extrinsicObject: any
): string {
  return getResponseHomeCommunityId(extrinsicObject);
}

function parseDocumentReference(
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  extrinsicObject: any,
  outboundRequest: OutboundDocumentQueryReq
): DocumentReference | undefined {
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
    return slot
      ? Array.isArray(slot.ValueList.Value)
        ? slot.ValueList.Value.join(", ")
        : slot.ValueList.Value
      : undefined;
  };

  const findExternalIdentifierValue = (scheme: string): string | undefined => {
    const identifier = externalIdentifiers?.find(
      (identifier: Identifier) => identifier._identificationScheme === scheme
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

    const slotArray = Array.isArray(classification.Slot)
      ? classification.Slot
      : [classification.Slot];
    const classificationSlots = slotArray.flatMap((slot: Slot) => slot ?? []);

    const slot = classificationSlots.find((s: Slot) => s._name === slotName);
    return slot
      ? Array.isArray(slot.ValueList.Value)
        ? slot.ValueList.Value.join(", ")
        : slot.ValueList.Value
      : undefined;
  };

  const findClassificationName = (scheme: string): string | undefined => {
    const classification = classifications?.find(
      (classification: Classification) => classification?._classificationScheme === scheme
    );
    if (!classification) return undefined;
    const title = classification?.Name?.LocalizedString?._value;
    return title;
  };

  const sizeValue = findSlotValue("size");
  const repositoryUniqueId = findSlotValue("repositoryUniqueId");
  const docUniqueId = findExternalIdentifierValue(XDSDocumentEntryUniqueId);

  if (!repositoryUniqueId || !docUniqueId) {
    const msg = "Document Reference is missing repositoryUniqueId or docUniqueId";
    capture.error(msg, {
      extra: {
        extrinsicObject,
        repositoryUniqueId,
        docUniqueId,
      },
    });
    return undefined;
  }

  const creationTime = findSlotValue("creationTime");

  const documentReference: DocumentReference = {
    homeCommunityId: getHomeCommunityIdForDr(outboundRequest, extrinsicObject),
    repositoryUniqueId,
    docUniqueId,
    contentType: extrinsicObject?._mimeType,
    language: findSlotValue("languageCode"),
    size: sizeValue ? parseInt(sizeValue) : undefined,
    title: findClassificationName(XDSDocumentEntryClassCode),
    creation: creationTime ? parseCreationTime(String(creationTime)) : undefined,
    authorInstitution: findClassificationSlotValue(XDSDocumentEntryAuthor, "authorInstitution"),
  };
  return documentReference;
}

function handleSuccessResponse({
  extrinsicObjects,
  outboundRequest,
  gateway,
}: {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  extrinsicObjects: any;
  outboundRequest: OutboundDocumentQueryReq;
  gateway: XCAGateway;
}): OutboundDocumentQueryResp {
  const documentReferences = Array.isArray(extrinsicObjects)
    ? extrinsicObjects.flatMap(
        extrinsicObject => parseDocumentReference(extrinsicObject, outboundRequest) ?? []
      )
    : [parseDocumentReference(extrinsicObjects, outboundRequest) ?? []].flat();

  const response: OutboundDocumentQueryResp = {
    id: outboundRequest.id,
    patientId: outboundRequest.patientId,
    timestamp: outboundRequest.timestamp,
    responseTimestamp: dayjs().toISOString(),
    gateway,
    documentReference: documentReferences,
    externalGatewayPatient: outboundRequest.externalGatewayPatient,
  };
  return response;
}

export function processDQResponse({
  dqResponse: { response, success, gateway, outboundRequest },
}: {
  dqResponse: DQSamlClientResponse;
}): OutboundDocumentQueryResp {
  if (success === false) {
    return handleHttpErrorResponse({
      httpError: response,
      outboundRequest,
      gateway: gateway,
    });
  }
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    textNodeName: "_text",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });

  const jsonObj = parser.parse(response);
  const status = jsonObj?.Envelope?.Body?.AdhocQueryResponse?._status?.split(":").pop();
  const extrinsicObjects =
    jsonObj?.Envelope?.Body?.AdhocQueryResponse?.RegistryObjectList?.ExtrinsicObject;
  const registryErrorList = jsonObj?.Envelope?.Body?.AdhocQueryResponse?.RegistryErrorList;

  if ((status === successStatus || status === partialSuccessStatus) && extrinsicObjects) {
    return handleSuccessResponse({
      extrinsicObjects,
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
}
