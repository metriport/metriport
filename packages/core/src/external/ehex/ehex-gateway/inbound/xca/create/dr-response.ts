import { InboundDocumentRetrievalResp } from "@metriport/ihe-gateway-sdk";
import { XMLBuilder } from "fast-xml-parser";
import { Config } from "../../../../../../util/config";
import { wrapIdInUrnOid } from "../../../../../../util/urn";
import { S3Utils } from "../../../../../aws/s3";
import { namespaces } from "../../../constants";
import { createMtomContentTypeAndPayload } from "../../../outbound/xca/mtom/builder";
import { xmlBuilderAttributes } from "../../../shared";
import {
  buildRegistryErrorList,
  createSecurityHeader,
  failureStatus,
  successStatus,
} from "../../shared";

const region = Config.getAWSRegion();
const medicalDocumentsBucketName = Config.getMedicalDocumentsBucketName();
let s3UtilsInstance = new S3Utils(region);

function getS3UtilsInstance(): S3Utils {
  return s3UtilsInstance;
}

export function setS3UtilsInstance(s3Utils: S3Utils): void {
  s3UtilsInstance = s3Utils;
}

async function createIti39SoapBody(response: InboundDocumentRetrievalResp): Promise<object> {
  const isSuccess = response?.documentReference ? true : false;
  const registryErrorList = buildRegistryErrorList(response, isSuccess);

  const retrieveDocumentSetResponse: Record<string, unknown> = {
    "@_xmlns": namespaces.urnihe,
    RegistryResponse: {
      "@_xmlns": namespaces.rs,
      "@_status": isSuccess ? successStatus : failureStatus,
      ...registryErrorList,
    },
  };

  const documentResponses = await buildDocumentResponses(response, isSuccess);
  if (documentResponses) {
    retrieveDocumentSetResponse.DocumentResponse = documentResponses;
  }

  const soapBody = {
    "@_xmlns": namespaces.urn,
    "@_xmlns:xsd": namespaces.xs,
    "@_xmlns:xsi": namespaces.xsi,
    RetrieveDocumentSetResponse: retrieveDocumentSetResponse,
  };
  return soapBody;
}

export async function createInboundDrResponse(
  response: InboundDocumentRetrievalResp
): Promise<{ contentType: string; payload: Buffer }> {
  const securityHeader = createSecurityHeader({
    signatureConfirmation: response.signatureConfirmation,
  });
  const soapBody = await createIti39SoapBody(response);

  const soapEnvelope = {
    "soap:Envelope": {
      "@_xmlns:soap": namespaces.soap,
      "@_xmlns:wsa": namespaces.wsa,
      "soap:Header": {
        ...securityHeader,
        "wsa:Action": {
          "#text": "urn:ihe:iti:2007:CrossGatewayRetrieveResponse",
          "@_mustUnderstand": "1",
        },
        "wsa:RelatesTo": response.id,
      },
      "soap:Body": soapBody,
    },
  };

  const builder = new XMLBuilder(xmlBuilderAttributes);
  const xmlContent = builder.build(soapEnvelope);
  return createMtomContentTypeAndPayload(xmlContent);
}

export async function buildDocumentResponses(
  response: InboundDocumentRetrievalResp,
  isSuccess: boolean
): Promise<object | undefined> {
  if (!isSuccess || !response?.documentReference || response.documentReference.length < 1) {
    return undefined;
  }

  const s3Utils = getS3UtilsInstance();
  const documentResponses = await Promise.all(
    response.documentReference.map(async entry => {
      if (!entry.urn) {
        throw new Error("Document URN is required");
      }
      const doc = await s3Utils.downloadFile({
        key: entry.urn,
        bucket: medicalDocumentsBucketName,
      });
      const doc64 = Buffer.from(doc).toString("base64");
      const dr: Record<string, unknown> = {};
      dr.HomeCommunityId = wrapIdInUrnOid(entry.homeCommunityId);
      dr.RepositoryUniqueId = entry.repositoryUniqueId;
      dr.DocumentUniqueId = entry.docUniqueId;
      dr.mimeType = entry.contentType ?? "application/octet-stream";
      dr.Document = doc64;
      return dr;
    })
  );
  return documentResponses;
}
