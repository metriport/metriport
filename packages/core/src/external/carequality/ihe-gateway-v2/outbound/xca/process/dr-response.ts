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
} from "./error";
import { parseFileFromString } from "./parse-file-from-string";
import { stripUrnPrefix } from "../../../../../../util/urn";
import { DRSamlClientResponse } from "../send/dr-requests";
import { successStatus, partialSuccessStatus } from "./constants";
import { S3Utils } from "../../../../../aws/s3";
import { Config } from "../../../../../../util/config";
import { createDocumentFilePath } from "../../../../../../domain/document/filename";
import { MetriportError } from "../../../../../../util/error/metriport-error";

const bucket = Config.getMedicalDocumentsBucketName();
const region = Config.getAWSRegion();

type DocumentResponse = {
  size: string;
  title: string;
  creation: string;
  language: string;
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
    homeCommunityId: documentResponse.HomeCommunityId,
    repositoryUniqueId: documentResponse.RepositoryUniqueId,
    newDocumentUniqueId: documentResponse.NewDocumentUniqueId,
    newRepositoryUniqueId: documentResponse.NewRepositoryUniqueId,
    isNew: !fileInfo.exists,
  };
}

async function handleSuccessResponse({
  documentResponses,
  outboundRequest,
  gateway,
}: {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  documentResponses: any;
  outboundRequest: OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
}): Promise<OutboundDocumentRetrievalResp> {
  const s3Utils = new S3Utils(region);

  const idMapping = outboundRequest.documentReference.reduce(
    (acc: Record<string, string>, entry) => {
      if (entry.docUniqueId && entry.metriportId) {
        acc[stripUrnPrefix(entry.docUniqueId)] = entry.metriportId;
      }
      return acc;
    },
    {}
  );

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

export async function processDRResponse({
  drResponse: { response, success, gateway, outboundRequest },
}: {
  drResponse: DRSamlClientResponse;
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
