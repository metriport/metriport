import axios from "axios";
import fs from "fs";
import https from "https";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import {
  outboundPatientDiscoveryReqSchema,
  OutboundPatientDiscoveryResp,
} from "@metriport/ihe-gateway-sdk";
import { createAndSignBulkXCPDRequests } from "@metriport/core/external/saml/xcpd/iti55-envelope";
import { processXCPDResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/process-xcpd-response";
import { sendSignedRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/saml-client";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import * as dotenv from "dotenv";
dotenv.config();

const apiUrl = getEnvVarOrFail("API_URL");
const patientDiscoveryUrl = `${apiUrl}/internal/carequality/patient-discovery/response`;

// const jsonObject = {
//   "id": "018ea97e-7b1c-78e9-8aa1-47c7caf85afe",
//   "timestamp": "2024-04-04T19:11:55.879Z",
//   "responseTimestamp": "2024-04-09T18:29:41.427Z",
//   "gateway": {
//     "oid": "2.16.840.1.113883.3.6147.458",
//     "url": "https://ihe.staging.metriport.com/v1/patient-discovery",
//     "id": "018ea97e-7b1c-78e9-8aa1-47bc01031eac"
//   },
//   "patientId": "018ebfae-f304-742a-86a2-10150410f867",
//   "patientMatch": null,
//   "operationOutcome": {
//     "resourceType": "OperationOutcome",
//     "id": "018ea97e-7b1c-78e9-8aa1-47c7caf85afe",
//     "issue": [{
//       "severity": "error",
//       "code": "http-error",
//       "details": {
//         "text": "getaddrinfo ENOTFOUND ihe.staging.metriport.com; caused by getaddrinfo ENOTFOUND ihe.staging.metriport.com"
//       }
//     }]
//   }
// };

const outboundRequest = {
  id: "018ea97e-7b1c-78e9-8aa1-47c7caf85afe",
  cxId: "51f45a48-ae44-432f-bd10-a3717544a5f1",
  patientId: "018ebfae-f304-742a-86a2-10150410f867",
  timestamp: "2024-04-04T19:11:55.879Z",
  principalCareProviderIds: ["1234567890"],
  samlAttributes: {
    subjectId: "America Inc",
    subjectRole: {
      code: "106331006",
      display: "Administrative AND/OR managerial worker",
    },
    organization: "White House Medical Inc",
    organizationId: "2.16.840.1.113883.3.9621.5.213",
    homeCommunityId: "2.16.840.1.113883.3.9621.5.213",
    purposeOfUse: "TREATMENT",
  },
  patientResource: {
    name: [
      {
        given: ["NWHINONE"],
        family: "NWHINZZZTESTPATIENT",
      },
    ],
    gender: "male",
    birthDate: "19810101",
    address: [
      {
        line: ["1100 Test Street"],
        city: "Helena",
        state: "AL",
        postalCode: "35080",
        country: "US",
      },
    ],
  },
  gateways: [
    {
      url: "https://ihe.staging.metriport.com/v1/patient-discovery",
      oid: "1.2.840.114350.1.13.11511.3.7.3.688884.100.1000",
      id: "018ea97e-7b1c-78e9-8aa1-47bc01031eac",
    },
    {
      url: "https://sfd-np.et0121.epichosted.com:14430/interconnect-ce-env1/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
      oid: "1.2.840.114350.1.13.11511.3.7.3.688884.100.1000",
      id: "018ea97e-7b1c-78e9-8aa1-47bc01031eac",
    },
  ],
};

export async function localXCPD({
  patientId,
  cxId,
  pdRequestGirth,
}: {
  patientId: string;
  cxId: string;
  pdRequestGirth: string;
}): Promise<void> {
  const privateKey = await getSecret(getEnvVarOrFail("CQ_ORG_PRIVATE_KEY"));
  const privateKeyPassword = await getSecret(getEnvVarOrFail("CQ_ORG_PRIVATE_KEY_PASSWORD"));
  const publicCert = await getSecret(getEnvVarOrFail("CQ_ORG_CERTIFICATE"));
  const certChain = await getSecret(getEnvVarOrFail("CQ_ORG_CERT_CHAIN"));
  if (
    !privateKey ||
    typeof privateKey !== "string" ||
    !privateKeyPassword ||
    typeof privateKeyPassword !== "string" ||
    !publicCert ||
    typeof publicCert !== "string" ||
    !certChain ||
    typeof certChain !== "string"
  ) {
    throw new Error("Failed to get secrets or one of the secrets is not a string.");
  }

  // validate request
  const xcpdRequest = outboundPatientDiscoveryReqSchema.safeParse(JSON.parse(pdRequestGirth));
  if (!xcpdRequest.success) {
    console.error("Invalid request:", JSON.stringify(xcpdRequest.error, null, 2));
    throw Error;
  }
  const signedRequests = createAndSignBulkXCPDRequests(
    xcpdRequest.data,
    publicCert,
    privateKey,
    privateKeyPassword
  );
  fs.writeFileSync("../../scratch/outbound_xcpd_2.xml", signedRequests[0].signedRequest);
  const responses = await sendSignedRequests({
    signedRequests,
    certChain,
    publicCert,
    privateKey,
    privateKeyPassword,
    patientId,
    cxId,
  });
  console.log("valid responses");
  const results: OutboundPatientDiscoveryResp[] = responses.map((response, index) => {
    console.log("processing response", index);
    fs.writeFileSync(`../../scratch/outbound_xcpd_2_response_${index}.xml`, response as string);

    const gateway = xcpdRequest.data.gateways[index];
    if (!gateway) {
      throw new Error(`Gateway at index ${index} is undefined.`);
    }

    console.log("gateway", gateway);
    return processXCPDResponse({
      xmlStringOrError: response,
      outboundRequest: xcpdRequest.data,
      gateway,
    });
  });
  console.log("results", JSON.stringify(results, null, 2));
  //send results to internal endpoint
  for (const result of results) {
    await axios.post(patientDiscoveryUrl, result);
  }
}

export async function sendSignedXml(
  signedXml: string,
  url: string,
  certFilePath: string,
  keyFilePath: string,
  passphrase: string
): Promise<string> {
  const agent = new https.Agent({
    rejectUnauthorized: false,
    cert: fs.readFileSync(certFilePath),
    key: fs.readFileSync(keyFilePath),
    passphrase,
  });

  const response = await axios.post(url, signedXml, {
    headers: {
      "Content-Type": "application/soap+xml;charset=UTF-8",
      "Cache-Control": "no-cache",
    },
    httpsAgent: agent,
  });

  return response.data;
}

export async function main() {
  try {
    await localXCPD({
      patientId: "018ebfae-f304-742a-86a2-10150410f867",
      cxId: "51f45a48-ae44-432f-bd10-a3717544a5f1",
      pdRequestGirth: JSON.stringify(outboundRequest),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Failed to process bulk XCPD requests:", JSON.stringify(error, null, 2));
  }
}
main();
