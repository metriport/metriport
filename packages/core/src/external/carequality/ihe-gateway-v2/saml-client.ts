import https from "https";
import axios from "axios";
import * as AWS from "aws-sdk";
import { XCPDGateway, XCAGateway } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "../../../util/error/shared";
import { BulkSignedXCPD } from "../../saml/xcpd/iti55-envelope";
import { BulkSignedDQ } from "../../saml/xca/iti38-envelope";
import { BulkSignedDR } from "../../saml/xca/iti39-envelope";
import { isGatewayWithOid } from "./utils";
import { capture } from "../../../util/notifications";
import { verifySaml } from "../../saml/security/verify";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
const { log } = out("Saml Client:");

export type SamlClientResponse = {
  gateway: XCPDGateway | XCAGateway;
  response: string;
  success: boolean;
};

export async function sendSignedXml({
  signedXml,
  url,
  certChain,
  publicCert,
  key,
  passphrase,
}: {
  signedXml: string;
  url: string;
  certChain: string;
  publicCert: string;
  key: string;
  passphrase: string;
}): Promise<string> {
  const trustedKeyStore = await getTrustedKeyStore();
  console.log("Trusted key store: ", trustedKeyStore);

  const agent = new https.Agent({
    rejectUnauthorized: true,
    cert: certChain,
    key: key,
    passphrase,
    ca: trustedKeyStore,
  });

  const verified = verifySaml({ xmlString: signedXml, publicCert });
  if (!verified) {
    console.log("Signature verification failed.");
    throw new Error("Signature verification failed.");
  }
  const response = await axios.post(url, signedXml, {
    headers: {
      "Content-Type": "application/soap+xml;charset=UTF-8",
      "Cache-Control": "no-cache",
    },
    httpsAgent: agent,
  });

  // TEMP
  console.log("Response from gateway: ", response.data);

  return response.data;
}

export async function sendSignedRequests({
  signedRequests,
  certChain,
  publicCert,
  privateKey,
  privateKeyPassword,
  patientId,
  cxId,
}: {
  signedRequests: BulkSignedXCPD[] | BulkSignedDQ[] | BulkSignedDR[];
  certChain: string;
  publicCert: string;
  privateKey: string;
  privateKeyPassword: string;
  patientId: string;
  cxId: string;
}): Promise<SamlClientResponse[]> {
  const requestPromises = signedRequests.map(async (request, index) => {
    try {
      const response = await sendSignedXml({
        signedXml: request.signedRequest,
        url: request.gateway.url,
        certChain,
        publicCert,
        key: privateKey,
        passphrase: privateKeyPassword,
      });
      console.log(
        `Request ${index + 1} sent successfully to: ${request.gateway.url} + oid: ${
          isGatewayWithOid(request.gateway) ? request.gateway.oid : request.gateway.homeCommunityId
        }`
      );
      return {
        gateway: request.gateway,
        response,
        success: true,
      };
    } catch (error) {
      const msg = "HTTP/SSL Failure Sending Signed SAML Request";
      const requestDetails = `Request ${index + 1} ERRORs for gateway: ${
        request.gateway.url
      } + oid: ${
        isGatewayWithOid(request.gateway) ? request.gateway.oid : request.gateway.homeCommunityId
      }`;
      console.log(msg, error);

      const errorString: string = errorToString(error);
      const extra = {
        errorString,
        requestDetails,
        patientId,
        cxId,
      };
      capture.error(msg, {
        extra: {
          context: `lambda.iheGatewayV2-outbound-patient-discovery`,
          extra,
        },
      });
      return {
        gateway: request.gateway,
        response: errorString,
        success: false,
      };
    }
  });

  const responses = await Promise.allSettled(requestPromises);
  const processedResponses: SamlClientResponse[] = responses
    .map(result => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        return undefined;
      }
    })
    .filter((response): response is SamlClientResponse => response !== undefined);

  return processedResponses;
}

async function getTrustedKeyStore(): Promise<string> {
  const s3 = new AWS.S3({ region: Config.getAWSRegion() });
  const trustBundleBucketName = Config.getCqTrustBundleBucketName();
  const key = `trust_store_${Config.getEnvType()}_aws.pem`;
  const response = await s3.getObject({ Bucket: trustBundleBucketName, Key: key }).promise();
  if (!response.Body) {
    log("Trust bundle not found.");
    throw new Error("Trust bundle not found.");
  }
  const trustBundle = response.Body.toString();
  return trustBundle;
}
