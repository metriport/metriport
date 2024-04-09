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
    patientId: outboundRequest.patientId || "",
    operationOutcome: operationOutcome,
  };
}

type Identifier = {
  "@_identificationScheme": string;
  "@_value": string;
};

function parseDocumentReference(
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  extrinsicObject: any,
  outboundRequest: OutboundDocumentQueryReq
): DocumentReference {
  const slots = extrinsicObject["Slot"] || [];
  const externalIdentifiers = extrinsicObject["ExternalIdentifier"] || [];
  const classifications = extrinsicObject["Classification"] || [];

  const findSlotValue = (name: string) => {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slot = slots.find((slot: any) => slot["@_name"] === name);
    return slot ? slot["ValueList"]["Value"] : undefined;
  };

  const findExternalIdentifierValue = (scheme: string) => {
    const identifier = externalIdentifiers.find(
      (identifier: Identifier) => identifier["@_identificationScheme"] === scheme
    );
    return identifier ? identifier["@_value"] : undefined;
  };

  const findClassificationName = (scheme: string) => {
    const classification = classifications.find(
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
      (classification: any) => classification["@_classificationScheme"] === scheme
    );
    if (!classification) return undefined;

    const localizedName = classification["Name"]?.["LocalizedString"];
    if (!Array.isArray(localizedName) || localizedName.length === 0) return undefined;

    return localizedName[0]["@_value"];
  };

  const documentReference: DocumentReference = {
    homeCommunityId: outboundRequest.gateway.homeCommunityId,
    repositoryUniqueId: findSlotValue("repositoryUniqueId"),
    docUniqueId: findExternalIdentifierValue("urn:uuid:2e82c1f6-a085-4c72-9da3-8640a32e42ab"),
    contentType: extrinsicObject["@_mimeType"],
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
    const registryErrors = Array.isArray(registryErrorList.RegistryError)
      ? registryErrorList.RegistryError
      : [registryErrorList.RegistryError];
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    registryErrors.forEach((entry: any) => {
      const issue = {
        severity: entry["@_severity"]?.toString().toLowerCase().split(":").pop() || "",
        code: entry["@_errorCode"]?.toString() || "",
        details: {
          text: entry["@_codeContext"]?.toString() || "",
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
    });

    if (typeof xmlStringOrError !== "string") {
      throw new Error("xmlStringOrError is not a string");
    }
    const jsonObj = parser.parse(xmlStringOrError);

    const status = jsonObj["soap:Envelope"]["soap:Body"]["query:AdhocQueryResponse"]["@_status"];

    if (status === "urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Success") {
      const extrinsicObjects =
        jsonObj["soap:Envelope"]["soap:Body"]["query:AdhocQueryResponse"]["RegistryObjectList"][
          "ExtrinsicObject"
        ];

      const documentReferences = Array.isArray(extrinsicObjects)
        ? extrinsicObjects.map(extrinsicObject =>
            parseDocumentReference(extrinsicObject, outboundRequest)
          )
        : [parseDocumentReference(extrinsicObjects, outboundRequest)];

      const response: OutboundDocumentQueryResp = {
        id: outboundRequest.id,
        timestamp: outboundRequest.timestamp,
        responseTimestamp: new Date().toISOString(),
        gateway,
        documentReference: documentReferences,
      };

      return response;
    } else {
      const operationOutcome: OperationOutcome = {
        resourceType: "OperationOutcome",
        id: outboundRequest.id,
        issue: [
          {
            severity: "error",
            code: "processing-error",
            details: {
              text: "Error processing DQ response",
            },
          },
        ],
      };

      return {
        id: outboundRequest.id,
        timestamp: outboundRequest.timestamp,
        responseTimestamp: new Date().toISOString(),
        gateway,
        documentReference: undefined,
        operationOutcome,
      };
    }
  }
}
