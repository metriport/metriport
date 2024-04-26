import { XMLParser } from "fast-xml-parser";
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
import { S3Utils } from "../../../aws/s3";
import { Config } from "../../../../util/config";
import { stripUrnPrefix, constructFileName, constructFilePath } from "../utils";
import { DRSamlClientResponse } from "../saml-client";

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
  // lets extract the document here.
  const { mimeType, extension, decodedBytes } = parseFileFromString(documentResponse?.Document);
  const strippedDocUniqueId = stripUrnPrefix(documentResponse?.DocumentUniqueId);
  const metriportId = idMapping[strippedDocUniqueId];
  if (!metriportId) {
    throw new Error("MetriportId not found for document");
  }
  const fileName = constructFileName({
    cxId: outboundRequest.cxId,
    patientId: outboundRequest.patientId,
    metriportId,
    extension,
  });
  const filePath = constructFilePath({
    cxId: outboundRequest.cxId,
    patientId: outboundRequest.patientId,
    fileName,
  });
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
    url: "https://" + bucket + ".s3." + region + ".amazonaws.com/" + filePath,
    size: documentResponse?.size ? parseInt(documentResponse?.size) : undefined,
    title: documentResponse?.title,
    fileName: fileName,
    creation: documentResponse?.creation,
    language: documentResponse?.language,
    contentType: mimeType,
    docUniqueId: documentResponse?.DocumentUniqueId?.toString(),
    metriportId: metriportId,
    fileLocation: bucket,
    homeCommunityId: documentResponse?.HomeCommunityId,
    repositoryUniqueId: documentResponse?.RepositoryUniqueId,
    newDocumentUniqueId: documentResponse?.NewDocumentUniqueId,
    newRepositoryUniqueId: documentResponse?.NewRepositoryUniqueId,
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
    responseTimestamp: new Date().toISOString(),
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
  } else {
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
    const documentResponses =
      jsonObj?.Envelope?.Body?.RetrieveDocumentSetResponse?.DocumentResponse;
    const soapFault = jsonObj?.Envelope?.Body?.Fault;

    if ((status === "Success" || status === "PartialSuccess") && documentResponses) {
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
}
