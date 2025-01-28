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
  handleSchemaErrorResponse,
} from "./error";
import { createXMLParser } from "@metriport/shared/common/xml-parser";
import { parseFileFromString, parseFileFromBuffer } from "./parse-file-from-string";
import { stripUrnPrefix, stripBrackets } from "../../../../../../util/urn";
import { DrSamlClientResponse } from "../send/dr-requests";
import { MtomAttachments, MtomPart } from "../mtom/parser";
import { successStatus, partialSuccessStatus } from "./constants";
import { S3Utils } from "../../../../../aws/s3";
import { Config } from "../../../../../../util/config";
import { createDocumentFilePath } from "../../../../../../domain/document/filename";
import { MetriportError } from "../../../../../../util/error/metriport-error";
import { getCidReference } from "../mtom/cid";
import { out } from "../../../../../../util/log";
import { errorToString, toArray } from "@metriport/shared";
import { iti39Schema, DocumentResponse } from "./schema";
import { capture } from "../../../../../../util/notifications";

const { log } = out("DR Processing");

const region = Config.getAWSRegion();
const bucket = Config.getMedicalDocumentsBucketName();

let s3UtilsInstance = new S3Utils(region);
function getS3UtilsInstance(): S3Utils {
  return s3UtilsInstance;
}
export function setS3UtilsInstance(s3Utils: S3Utils): void {
  s3UtilsInstance = s3Utils;
}

function documentResponseContainsMultipartCidReferenceToDocument(
  documentResponse: DocumentResponse
): documentResponse is DocumentResponse & { Document: { Include: { _href: string } } } {
  return (
    typeof documentResponse.Document !== "string" && !!documentResponse.Document?.Include?._href
  );
}

function documentResponseContainsDocumentInSoapMessage(
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
  if (documentResponseContainsMultipartCidReferenceToDocument(documentResponse)) {
    const cid = getCidReference(documentResponse.Document.Include._href);
    const attachment = getMtomAttachment(cid, mtomResponse);
    const { mimeType, decodedBytes } = parseFileFromBuffer(attachment.body);
    return { mimeType, decodedBytes };
  } else if (documentResponseContainsDocumentInSoapMessage(documentResponse)) {
    const { mimeType, decodedBytes } = parseFileFromString(documentResponse.Document);
    return { mimeType, decodedBytes };
  }
  throw new Error("Invalid document response");
}

async function processDocumentReference({
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
  try {
    const s3Utils = getS3UtilsInstance();
    const { mimeType, decodedBytes } = getMtomBytesAndMimeType(documentResponse, mtomResponse);
    const strippedDocUniqueId = stripBrackets(stripUrnPrefix(documentResponse.DocumentUniqueId));
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
        content: decodedBytes,
        contentType: mimeType,
      });
    }

    log(
      `Downloaded a document with mime type: ${mimeType} for patient: ${outboundRequest.patientId} and request: ${outboundRequest.id}`
    );

    return {
      url: s3Utils.buildFileUrl(bucket, filePath),
      size: documentResponse.size ? parseInt(documentResponse.size) : undefined,
      title: documentResponse.title,
      fileName: filePath,
      creation: documentResponse.creation,
      language: documentResponse.language,
      contentType: mimeType,
      docUniqueId: documentResponse.DocumentUniqueId.toString(),
      metriportId: metriportId,
      fileLocation: bucket,
      homeCommunityId: documentResponse.HomeCommunityId
        ? stripUrnPrefix(documentResponse.HomeCommunityId)
        : outboundRequest.gateway.homeCommunityId,
      repositoryUniqueId: documentResponse.RepositoryUniqueId
        ? stripUrnPrefix(documentResponse.RepositoryUniqueId)
        : outboundRequest.gateway.homeCommunityId,
      newDocumentUniqueId: documentResponse.NewDocumentUniqueId,
      newRepositoryUniqueId: documentResponse.NewRepositoryUniqueId,
      isNew: !fileInfo.exists,
    };
  } catch (error) {
    const msg = "Error processing Document Reference";
    log(`${msg}: ${error}`);
    capture.error(msg, {
      extra: {
        error,
        outboundRequest,
        documentResponse,
      },
    });
    throw new MetriportError(`Error Processing Document Reference`, error);
  }
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
    const documentReferencesResults = await Promise.allSettled(
      documentResponses.map((documentResponse: DocumentResponse) =>
        processDocumentReference({ documentResponse, outboundRequest, idMapping, mtomResponse })
      )
    );

    const documentReferences = documentReferencesResults
      .filter(
        (result): result is PromiseFulfilledResult<DocumentReference> =>
          result.status === "fulfilled"
      )
      .map(result => result.value);

    const response: OutboundDocumentRetrievalResp = {
      id: outboundRequest.id,
      requestChunkId: outboundRequest.requestChunkId,
      patientId: outboundRequest.patientId,
      timestamp: outboundRequest.timestamp,
      requestTimestamp: outboundRequest.timestamp,
      responseTimestamp: dayjs().toISOString(),
      gateway,
      documentReference: documentReferences,
      iheGatewayV2: true,
    };
    return response;
  } catch (error) {
    throw new MetriportError(`Error Processing Success Response`, error);
  }
}

export async function processDrResponse({
  response: { errorResponse, mtomResponse, gateway, outboundRequest },
}: {
  response: DrSamlClientResponse;
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
  const parser = createXMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    textNodeName: "_text",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });
  const jsonObj = parser.parse(soapData.toString());

  try {
    const iti39Response = iti39Schema.parse(jsonObj);

    const status = iti39Response.Envelope.Body.RetrieveDocumentSetResponse.RegistryResponse._status
      ?.split(":")
      .pop();
    const registryErrorList =
      iti39Response.Envelope.Body.RetrieveDocumentSetResponse.RegistryResponse.RegistryErrorList;
    const documentResponses =
      iti39Response.Envelope.Body.RetrieveDocumentSetResponse.DocumentResponse;

    if ((status === successStatus || status === partialSuccessStatus) && documentResponses) {
      return await handleSuccessResponse({
        documentResponses: toArray(documentResponses),
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
    } else {
      return handleEmptyResponse({
        outboundRequest,
        gateway,
      });
    }
  } catch (error) {
    log(`Error processing DR response ${JSON.stringify(error)}`);
    return handleSchemaErrorResponse({
      outboundRequest,
      gateway,
      text: errorToString(error),
    });
  }
}
