import { XMLParser } from "fast-xml-parser";
import {
  OutboundDocumentQueryReq,
  OutboundDocumentQueryResp,
  OperationOutcome,
  DocumentReference,
} from "@metriport/ihe-gateway-sdk";

export type GirthDQRequestParams = {
  patientId: string;
  cxId: string;
  dqRequestsGirth: OutboundDocumentQueryReq[];
};

type DQGateway = {
  homeCommunityId: string;
  url: string;
};

type Identifier = {
  "@_identificationScheme": string;
  "@_value": string;
};

type Classification = {
  "@_classificationScheme": string;
  Name: {
    LocalizedString: {
      "@_charset": string;
      "@_value": string;
    };
  };
};

type Slot = {
  "@_name": string;
  ValueList: {
    Value: string | string[];
  };
};

function parseDocumentReference(
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  extrinsicObject: any
): DocumentReference {
  const slots = extrinsicObject?.["Slot"] || [];
  const externalIdentifiers = extrinsicObject?.["ExternalIdentifier"];
  const classifications = extrinsicObject?.["Classification"];

  const findSlotValue = (name: string): string => {
    const slot = slots.find((slot: Slot) => slot["@_name"] === name);
    return slot ? slot?.["ValueList"]?.["Value"] : undefined;
  };

  const findExternalIdentifierValue = (scheme: string) => {
    const identifier = externalIdentifiers?.find(
      (identifier: Identifier) => identifier?.["@_identificationScheme"] === scheme
    );
    return identifier ? identifier["@_value"] : undefined;
  };

  const findClassificationName = (scheme: string) => {
    const classification = classifications?.find(
      (classification: Classification) => classification["@_classificationScheme"] === scheme
    );
    if (!classification) return undefined;
    const title = classification.Name.LocalizedString["@_value"];
    return title;
  };

  const documentReference: DocumentReference = {
    homeCommunityId: extrinsicObject?.["@_home"].replace("urn:oid:", ""),
    repositoryUniqueId: findSlotValue("repositoryUniqueId"),
    docUniqueId: findExternalIdentifierValue("urn:uuid:2e82c1f6-a085-4c72-9da3-8640a32e42ab"),
    contentType: extrinsicObject?.["@_mimeType"],
    language: findSlotValue("languageCode"),
    size: parseInt(findSlotValue("size")),
    title: findClassificationName("urn:uuid:41a5887f-8865-4c09-adf7-e362475b143a"),
    creation: findSlotValue("creationTime"),
    authorInstitution: findSlotValue("authorInstitution"),
  };
  return documentReference;
}

export function processRegistryErrorList(
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  registryErrorList: any,
  outboundRequest: OutboundDocumentQueryReq
): OperationOutcome | undefined {
  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    id: outboundRequest.id,
    issue: [],
  };

  try {
    const registryErrors = Array.isArray(registryErrorList?.RegistryError)
      ? registryErrorList.RegistryError
      : [registryErrorList?.RegistryError];
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    registryErrors.forEach((entry: any) => {
      const issue = {
        severity: entry?.["@_severity"]?.toString().toLowerCase().split(":").pop() || "",
        code: entry?.["@_errorCode"]?.toString() || "",
        details: {
          text: entry?.["@_codeContext"]?.toString() || "",
        },
      };

      // issue.diagnostics = entry["@_location"] ? `Location: ${entry["@_location"]}` : undefined;

      operationOutcome.issue.push(issue);
    });
  } catch (ex) {
    console.error("Error processing RegistryErrorList: ", ex);
  }

  return operationOutcome.issue.length > 0 ? operationOutcome : undefined;
}

function handleEmptyResponse({
  outboundRequest,
  gateway,
}: {
  outboundRequest: OutboundDocumentQueryReq;
  gateway: DQGateway;
}): OutboundDocumentQueryResp {
  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    id: outboundRequest.id,
    issue: [
      {
        severity: "information",
        code: "no-documents-found",
        details: {
          text: "No documents found",
        },
      },
    ],
  };
  return {
    id: outboundRequest.id,
    timestamp: outboundRequest.timestamp,
    responseTimestamp: new Date().toISOString(),
    gateway,
    operationOutcome,
  };
}

function handleHTTPErrorResponse({
  httpError,
  outboundRequest,
  gateway,
}: {
  httpError: string;
  outboundRequest: OutboundDocumentQueryReq;
  gateway: DQGateway;
}): OutboundDocumentQueryResp {
  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    id: outboundRequest.id,
    issue: [
      {
        severity: "error",
        code: "http-error",
        details: {
          text: httpError,
        },
      },
    ],
  };
  return {
    id: outboundRequest.id,
    timestamp: outboundRequest.timestamp,
    responseTimestamp: new Date().toISOString(),
    gateway: gateway,
    patientId: outboundRequest.patientId,
    operationOutcome: operationOutcome,
  };
}

function handleRegistryErrorResponse({
  registryErrorList,
  outboundRequest,
  gateway,
}: {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  registryErrorList: any;
  outboundRequest: OutboundDocumentQueryReq;
  gateway: DQGateway;
}): OutboundDocumentQueryResp {
  const operationOutcome = processRegistryErrorList(registryErrorList, outboundRequest);
  return {
    id: outboundRequest.id,
    timestamp: outboundRequest.timestamp,
    responseTimestamp: new Date().toISOString(),
    gateway,
    operationOutcome,
  };
}

function handleSuccessResponse({
  extrinsicObjects,
  outboundRequest,
  gateway,
}: {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  extrinsicObjects: any;
  outboundRequest: OutboundDocumentQueryReq;
  gateway: DQGateway;
}): OutboundDocumentQueryResp {
  const documentReferences = Array.isArray(extrinsicObjects)
    ? extrinsicObjects.map(extrinsicObject => parseDocumentReference(extrinsicObject))
    : [parseDocumentReference(extrinsicObjects)];

  const response: OutboundDocumentQueryResp = {
    id: outboundRequest.id,
    timestamp: outboundRequest.timestamp,
    responseTimestamp: new Date().toISOString(),
    gateway,
    documentReference: documentReferences,
  };
  return response;
}

export function processDQResponse({
  xmlStringOrError,
  outboundRequest,
  gateway,
}: {
  xmlStringOrError: string | { error: string };
  outboundRequest: OutboundDocumentQueryReq;
  gateway: DQGateway;
}): OutboundDocumentQueryResp {
  if (typeof xmlStringOrError === "object" && xmlStringOrError.error) {
    return handleHTTPErrorResponse({
      httpError: xmlStringOrError.error,
      outboundRequest,
      gateway,
    });
  } else {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: false,
      removeNSPrefix: true,
    });

    if (typeof xmlStringOrError !== "string") {
      throw new Error("xmlStringOrError is not a string");
    }
    const jsonObj = parser.parse(xmlStringOrError);
    const status = jsonObj?.["Envelope"]?.["Body"]?.["AdhocQueryResponse"]?.["@_status"]
      ?.split(":")
      .pop();
    const extrinsicObjects =
      jsonObj?.["Envelope"]?.["Body"]?.["AdhocQueryResponse"]?.["RegistryObjectList"]?.[
        "ExtrinsicObject"
      ];
    const registryErrorList =
      jsonObj?.["Envelope"]?.["Body"]?.["AdhocQueryResponse"]?.["RegistryErrorList"];

    if ((status === "Success" || status === "PartialSuccess") && extrinsicObjects) {
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
}
