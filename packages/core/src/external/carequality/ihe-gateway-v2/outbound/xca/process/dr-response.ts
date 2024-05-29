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
} from "./error";
import { parseFileFromString, parseFileFromBuffer } from "./parse-file-from-string";
import { stripUrnPrefix } from "../../../../../../util/urn";
import { DrSamlClientResponse } from "../send/dr-requests";
import { MtomAttachments, MtomPart } from "../mtom/parser";
import { successStatus, partialSuccessStatus } from "./constants";
import { S3Utils } from "../../../../../aws/s3";
import { Config } from "../../../../../../util/config";
import { createDocumentFilePath } from "../../../../../../domain/document/filename";
import { MetriportError } from "../../../../../../util/error/metriport-error";
import { getCidReference } from "../mtom/cid";

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
  Document: string | { Include: { _href: string } };
};

let s3UtilsInstance = new S3Utils(region);
export function getS3UtilsInstance(): S3Utils {
  return s3UtilsInstance;
}
export function setS3UtilsInstance(s3Utils: S3Utils): void {
  s3UtilsInstance = s3Utils;
}

function documentResponseContainsMultipartCidReference(
  documentResponse: DocumentResponse
): documentResponse is DocumentResponse & { Document: { Include: { _href: string } } } {
  return (
    typeof documentResponse.Document !== "string" && !!documentResponse.Document?.Include?._href
  );
}

function documentResponseContainsDocument(
  documentResponse: DocumentResponse
): documentResponse is DocumentResponse & { Document: string } {
  return typeof documentResponse.Document === "string";
}

function getMtomAttachment(cid: string, mtomResponse: MtomAttachments): MtomPart {
  const attachment = mtomResponse.parts.find(part => part.headers["content-id"] === cid);
  if (!attachment) {
    throw new Error(`Attachment with CID ${cid} not found`);
  }
  return attachment;
}

function getMtomBytesAndMimeType(
  documentResponse: DocumentResponse,
  mtomResponse: MtomAttachments
): { mimeType: string; decodedBytes: Buffer } {
  if (documentResponseContainsMultipartCidReference(documentResponse)) {
    const cid = getCidReference(documentResponse.Document.Include._href);
    const attachment = getMtomAttachment(cid, mtomResponse);
    const { mimeType, decodedBytes } = parseFileFromBuffer(attachment.body);
    return { mimeType, decodedBytes };
  } else if (documentResponseContainsDocument(documentResponse)) {
    const { mimeType, decodedBytes } = parseFileFromString(documentResponse.Document);
    return { mimeType, decodedBytes };
  }
  throw new Error("Invalid document response");
}

async function parseDocumentReference({
  documentResponse,
  outboundRequest,
  idMapping,
  mtomResponse,
}: {
  documentResponse: DocumentResponse;
  outboundRequest: OutboundDocumentRetrievalReq;
  idMapping: Record<string, string>;
  mtomResponse: MtomAttachments;
}): Promise<DocumentReference> {
  const s3Utils = getS3UtilsInstance();
  const { mimeType, decodedBytes } = getMtomBytesAndMimeType(documentResponse, mtomResponse);
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
  mtomResponse,
}: {
  documentResponses: DocumentResponse[];
  outboundRequest: OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
  mtomResponse: MtomAttachments;
}): Promise<OutboundDocumentRetrievalResp> {
  try {
    const idMapping = generateIdMapping(outboundRequest.documentReference);
    const documentReferences = Array.isArray(documentResponses)
      ? await Promise.all(
          documentResponses.map(async (documentResponse: DocumentResponse) =>
            parseDocumentReference({ documentResponse, outboundRequest, idMapping, mtomResponse })
          )
        )
      : [
          await parseDocumentReference({
            documentResponse: documentResponses,
            outboundRequest,
            idMapping,
            mtomResponse,
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

export async function processDrResponse({
  drResponse: { errorResponse, mtomResponse, gateway, outboundRequest },
}: {
  drResponse: DrSamlClientResponse;
}): Promise<OutboundDocumentRetrievalResp> {
  if (!gateway || !outboundRequest) throw new Error("Missing gateway or outboundRequest");
  if (errorResponse) {
    return handleHttpErrorResponse({
      httpError: errorResponse,
      outboundRequest,
      gateway,
    });
  }
  if (!mtomResponse) {
    throw new Error("No mtom response found");
  }
  const soapData: Buffer = mtomResponse.parts[0]?.body || Buffer.from("");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    textNodeName: "_text",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });
  const jsonObj = parser.parse(soapData.toString());

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
      mtomResponse,
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
