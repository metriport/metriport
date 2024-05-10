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
  handleHTTPErrorResponse,
  handleEmptyResponse,
  handleSOAPFaultResponse,
  handleErrorMTOMResponse,
} from "./error";
import { parseFileFromString } from "./parse-file-from-string";
import { stripUrnPrefix } from "../../../../../../util/urn";
import { DRSamlClientResponse } from "../send/dr-requests";
import { successStatus, partialSuccessStatus } from "./constants";
import { S3Utils } from "../../../../../aws/s3";
import { Config } from "../../../../../../util/config";
import { createFileName } from "../../../../../../domain/filename";
import {
  createDocumentFilePath,
  createDocumentFileName,
} from "../../../../../../domain/document/filename";
import { MetriportError } from "../../../../../../util/error/metriport-error";
import { capture } from "../../../../../../util/notifications";
import { parseMTOMResponse } from "./mtom-parser";

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

async function parseDocumentReference({
  documentResponse,
  outboundRequest,
  s3Utils,
  idMapping,
}: {
  documentResponse: DocumentResponse;
  outboundRequest: OutboundDocumentRetrievalReq;
  s3Utils: S3Utils;
  idMapping: Record<string, string>;
}): Promise<DocumentReference> {
  const { mimeType, decodedBytes } = parseFileFromString(documentResponse.Document);
  const strippedDocUniqueId = stripUrnPrefix(documentResponse.DocumentUniqueId);
  const metriportId = idMapping[strippedDocUniqueId];
  if (!metriportId) {
    throw new MetriportError("MetriportId not found for document");
  }

  const fileName = createFileName(outboundRequest.cxId, outboundRequest.patientId, metriportId);
  const documentFileName = createDocumentFileName(fileName, mimeType);
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
    fileName: documentFileName,
    creation: documentResponse.creation,
    language: documentResponse.language,
    contentType: mimeType,
    docUniqueId: documentResponse.DocumentUniqueId.toString(),
    metriportId: metriportId,
    fileLocation: bucket,
    homeCommunityId: documentResponse.HomeCommunityId,
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
  s3Utils,
}: {
  documentResponses: DocumentResponse[];
  outboundRequest: OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
  s3Utils: S3Utils;
}): Promise<OutboundDocumentRetrievalResp> {
  const idMapping = generateIdMapping(outboundRequest.documentReference);

  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  const documentReferences = Array.isArray(documentResponses)
    ? await Promise.all(
        documentResponses.map(async (documentResponse: DocumentResponse) =>
          parseDocumentReference({ documentResponse, outboundRequest, s3Utils, idMapping })
        )
      )
    : [
        await parseDocumentReference({
          documentResponse: documentResponses,
          outboundRequest,
          s3Utils,
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
}

export async function processDRResponseSOAP({
  drResponse: { response, success, gateway, outboundRequest },
  s3Utils,
}: {
  drResponse: DRSamlClientResponse;
  s3Utils: S3Utils;
}): Promise<OutboundDocumentRetrievalResp> {
  if (!gateway || !outboundRequest) throw new Error("Missing gateway or outboundRequest");
  if (success === false) {
    return handleHTTPErrorResponse({
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
    return handleSuccessResponse({
      documentResponses,
      outboundRequest,
      gateway,
      s3Utils,
    });
  } else if (registryErrorList) {
    return handleRegistryErrorResponse({
      registryErrorList,
      outboundRequest,
      gateway,
    });
  } else if (soapFault) {
    return handleSOAPFaultResponse({
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

export async function processDRResponseMTOM({
  drResponse: { response, success, gateway, outboundRequest, contentType },
  s3Utils,
}: {
  drResponse: DRSamlClientResponse;
  s3Utils: S3Utils;
}): Promise<OutboundDocumentRetrievalResp> {
  if (!contentType) {
    throw new Error("No content type found in response");
  }
  if (success === false) {
    return handleHTTPErrorResponse({
      httpError: response,
      outboundRequest,
      gateway,
    });
  }
  try {
    const documentResponses = parseMTOMResponse(response, contentType);
    return handleSuccessResponse({
      documentResponses,
      outboundRequest,
      gateway,
      s3Utils,
    });
  } catch (error) {
    console.log("Error parsing MTOM response", error);
    capture.error("Error parsing MTOM response", {
      extra: {
        error,
        response,
        contentType,
      },
    });
    return handleErrorMTOMResponse({
      outboundRequest,
      gateway,
    });
  }
}

export async function processDRResponse({
  drResponse,
  s3Utils,
}: {
  drResponse: DRSamlClientResponse;
  s3Utils: S3Utils;
}): Promise<OutboundDocumentRetrievalResp> {
  if (drResponse.contentType?.includes("multipart/related")) {
    return processDRResponseMTOM({ drResponse, s3Utils });
  } else {
    return processDRResponseSOAP({ drResponse, s3Utils });
  }
}
