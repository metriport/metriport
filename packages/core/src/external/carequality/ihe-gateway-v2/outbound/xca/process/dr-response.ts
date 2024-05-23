import { XMLParser } from "fast-xml-parser";
import dayjs from "dayjs";
import {
  OutboundDocumentRetrievalReq,
  OutboundDocumentRetrievalResp,
  XCAGateway,
  DocumentReference,
} from "@metriport/ihe-gateway-sdk";
import {
  handleRegistryErrorResponse,
  handleHttpErrorResponse,
  handleEmptyResponse,
  handleSoapFaultResponse,
  handleErrorMtomResponse,
} from "./error";
import { parseFileFromString } from "./parse-file-from-string";
import { stripUrnPrefix } from "../../../../../../util/urn";
import { DrSamlClientResponse } from "../send/dr-requests";
import { successStatus, partialSuccessStatus } from "./constants";
import { S3Utils } from "../../../../../aws/s3";
import { Config } from "../../../../../../util/config";
import { createDocumentFilePath } from "../../../../../../domain/document/filename";
import { MetriportError } from "../../../../../../util/error/metriport-error";
import { capture } from "../../../../../../util/notifications";
import { parseMtomResponse } from "../mtom/parser";

const region = Config.getAWSRegion();
const bucket = Config.getMedicalDocumentsBucketName();

export type DocumentResponse = {
  size?: string;
  title?: string;
  creation?: string;
  language?: string;
  mimeType: string;
  DocumentUniqueId: string;
  HomeCommunityId: string;
  RepositoryUniqueId: string;
  NewDocumentUniqueId: string;
  NewRepositoryUniqueId: string;
  Document: string;
};

let s3UtilsInstance = new S3Utils(region);
export function getS3UtilsInstance(): S3Utils {
  return s3UtilsInstance;
}
export function setS3UtilsInstance(s3Utils: S3Utils): void {
  s3UtilsInstance = s3Utils;
}

async function parseDocumentReference({
  documentResponse,
  outboundRequest,
  idMapping,
}: {
  documentResponse: DocumentResponse;
  outboundRequest: OutboundDocumentRetrievalReq;
  idMapping: Record<string, string>;
}): Promise<DocumentReference> {
  const s3Utils = getS3UtilsInstance();
  const { mimeType, decodedBytes } = parseFileFromString(documentResponse.Document);
  const strippedDocUniqueId = stripUrnPrefix(documentResponse.DocumentUniqueId);
  const metriportId = idMapping[strippedDocUniqueId];
  if (!metriportId) {
    throw new MetriportError("MetriportId not found for document");
  }

  const filePath = createDocumentFilePath(
    outboundRequest.cxId,
    outboundRequest.patientId,
    metriportId,
    mimeType
  );
  const fileInfo = await s3Utils.getFileInfoFromS3(filePath, bucket);

  if (!fileInfo.exists) {
    await s3Utils.uploadFile({
      bucket,
      key: filePath,
      file: decodedBytes,
      contentType: mimeType,
    });
  }

  return {
    url: s3Utils.buildFileUrl(bucket, filePath),
    size: documentResponse.size ? parseInt(documentResponse.size) : undefined,
    title: documentResponse?.title,
    fileName: filePath,
    creation: documentResponse.creation,
    language: documentResponse.language,
    contentType: mimeType,
    docUniqueId: documentResponse.DocumentUniqueId.toString(),
    metriportId: metriportId,
    fileLocation: bucket,
    homeCommunityId: outboundRequest.gateway.homeCommunityId,
    repositoryUniqueId: documentResponse.RepositoryUniqueId,
    newDocumentUniqueId: documentResponse.NewDocumentUniqueId,
    newRepositoryUniqueId: documentResponse.NewRepositoryUniqueId,
    isNew: !fileInfo.exists,
  };
}

function generateIdMapping(documentReferences: DocumentReference[]): Record<string, string> {
  return documentReferences.reduce((acc: Record<string, string>, entry) => {
    if (entry.docUniqueId && entry.metriportId) {
      acc[stripUrnPrefix(entry.docUniqueId)] = entry.metriportId;
    }
    return acc;
  }, {});
}

async function handleSuccessResponse({
  documentResponses,
  outboundRequest,
  gateway,
}: {
  documentResponses: DocumentResponse[];
  outboundRequest: OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
}): Promise<OutboundDocumentRetrievalResp> {
  try {
    const idMapping = generateIdMapping(outboundRequest.documentReference);
    const documentReferences = Array.isArray(documentResponses)
      ? await Promise.all(
          documentResponses.map(async (documentResponse: DocumentResponse) =>
            parseDocumentReference({ documentResponse, outboundRequest, idMapping })
          )
        )
      : [
          await parseDocumentReference({
            documentResponse: documentResponses,
            outboundRequest,
            idMapping,
          }),
        ];

    const response: OutboundDocumentRetrievalResp = {
      id: outboundRequest.id,
      patientId: outboundRequest.patientId,
      timestamp: outboundRequest.timestamp,
      responseTimestamp: dayjs().toISOString(),
      gateway,
      documentReference: documentReferences,
    };
    return response;
  } catch (error) {
    throw new MetriportError(`Error Processing Success Response`, error);
  }
}

export async function processDrResponseSoap({
  drResponse: { response, success, gateway, outboundRequest },
}: {
  drResponse: DrSamlClientResponse;
}): Promise<OutboundDocumentRetrievalResp> {
  if (!gateway || !outboundRequest) throw new Error("Missing gateway or outboundRequest");
  if (success === false) {
    return handleHttpErrorResponse({
      httpError: response,
      outboundRequest,
      gateway,
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

  const status = jsonObj?.Envelope?.Body?.RetrieveDocumentSetResponse?.RegistryResponse?._status
    ?.split(":")
    .pop();
  const registryErrorList =
    jsonObj?.Envelope?.Body?.RetrieveDocumentSetResponse?.RegistryResponse?.RegistryErrorList;
  const documentResponses = jsonObj?.Envelope?.Body?.RetrieveDocumentSetResponse?.DocumentResponse;
  const soapFault = jsonObj?.Envelope?.Body?.Fault;

  if ((status === successStatus || status === partialSuccessStatus) && documentResponses) {
    return await handleSuccessResponse({
      documentResponses,
      outboundRequest,
      gateway,
    });
  } else if (registryErrorList) {
    return handleRegistryErrorResponse({
      registryErrorList,
      outboundRequest,
      gateway,
    });
  } else if (soapFault) {
    return handleSoapFaultResponse({
      soapFault,
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

export async function processDrResponseMtom({
  drResponse: { response, success, gateway, outboundRequest, contentType },
}: {
  drResponse: DrSamlClientResponse;
}): Promise<OutboundDocumentRetrievalResp> {
  if (!contentType) {
    throw new Error("No content type found in response");
  }
  if (success === false) {
    return handleHttpErrorResponse({
      httpError: response,
      outboundRequest,
      gateway,
    });
  }
  try {
    const documentResponses = parseMtomResponse(response, contentType);
    return await handleSuccessResponse({
      documentResponses,
      outboundRequest,
      gateway,
    });
  } catch (error) {
    capture.error("Error parsing MTOM response", {
      extra: {
        error,
        response,
        outboundRequest,
        gateway,
      },
    });
    return handleErrorMtomResponse({
      outboundRequest,
      gateway,
    });
  }
}

function isMtomResponse(contentType: string | undefined): boolean {
  return contentType !== undefined && contentType.includes("multipart/related");
}

export async function processDrResponse({
  drResponse,
}: {
  drResponse: DrSamlClientResponse;
}): Promise<OutboundDocumentRetrievalResp> {
  if (isMtomResponse(drResponse?.contentType)) {
    return await processDrResponseMtom({ drResponse });
  } else {
    return await processDrResponseSoap({ drResponse });
  }
}
