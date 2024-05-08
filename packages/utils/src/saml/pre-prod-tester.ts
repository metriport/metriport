import * as dotenv from "dotenv";
dotenv.config();
import { initDbPool } from "@metriport/core/util/sequelize";
import { QueryTypes } from "sequelize";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { OutboundDocumentQueryResp, OutboundDocumentQueryReq } from "@metriport/ihe-gateway-sdk";
import { createAndSignBulkDQRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/create/iti38-envelope";
import { sendSignedDQRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/send/dq-requests";
import { processDQResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/process/dq-response";

const samlAtributes = {
  subjectId: "System User",
  subjectRole: {
    code: "106331006",
    display: "Administrative AND/OR managerial worker",
  },
  organization: "Metriport",
  organizationId: "2.16.840.1.113883.3.9621",
  homeCommunityId: "2.16.840.1.113883.3.9621",
  purposeOfUse: "TREATMENT",
};

async function queryDatabase() {
  const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
  const sequelize = initDbPool(sqlDBCreds);
  const query = `
    SELECT dqr.data
    FROM document_query_result dqr
    WHERE dqr.status = 'failure'
    ORDER BY RANDOM()
    LIMIT 100;
  `;

  try {
    const results = await sequelize.query(query, {
      type: QueryTypes.SELECT,
    });
    return results;
  } catch (error) {
    console.error("Error executing query:", error);
    throw error;
  }
}

async function DQIntegrationTest() {
  let successCount = 0;
  let failureCount = 0;
  let runTimeErrorCount = 0;

  const results = await queryDatabase();
  const promises = results.map(async result => {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dqResult = (result as any).data as OutboundDocumentQueryResp;
    if (!dqResult.cxId || !dqResult.patientId || !dqResult.externalGatewayPatient) {
      console.log("Skipping: ", dqResult.id);
      return undefined;
    }
    const dqRequest: OutboundDocumentQueryReq = {
      id: dqResult.id,
      cxId: dqResult.cxId,
      gateway: dqResult.gateway,
      timestamp: dqResult.timestamp,
      patientId: dqResult.patientId,
      samlAttributes: samlAtributes,
      externalGatewayPatient: dqResult.externalGatewayPatient,
    };
    try {
      const dqResponse = await queryDQ(dqRequest);
      return { dqResult, dqResponse };
    } catch (error) {
      console.error("Runtime error:", error);
      throw error;
    }
  });

  const responses = await Promise.allSettled(promises);
  responses.forEach(response => {
    if (response.status === "fulfilled" && response.value) {
      const { dqResult, dqResponse } = response.value;
      const resultDocumentReferences = new Set(
        dqResult?.documentReference?.map(doc => `${doc.repositoryUniqueId}-${doc.docUniqueId}`)
      );
      const responseDocumentReferences = new Set(
        dqResponse?.documentReference?.map(doc => `${doc.repositoryUniqueId}-${doc.docUniqueId}`)
      );

      if (
        (responseDocumentReferences.size > 0 || resultDocumentReferences.size > 0) &&
        responseDocumentReferences.size >= resultDocumentReferences.size
      ) {
        successCount++;
      } else {
        failureCount++;
      }
    } else if (response.status === "rejected") {
      runTimeErrorCount++;
    }
  });

  if (runTimeErrorCount > 0) {
    console.log(`TEST FAILED: ${runTimeErrorCount} run-time errors occurred`);
  } else {
    console.log("TEST PASSED");
  }
  console.log(`DQ Success Count: ${successCount}`);
  console.log(`DQ Failure Count: ${failureCount}`);
}

async function queryDQ(dqRequest: OutboundDocumentQueryReq): Promise<OutboundDocumentQueryResp> {
  try {
    const samlCertsAndKeys = {
      publicCert: getEnvVarOrFail("CQ_ORG_CERTIFICATE_PRODUCTION"),
      privateKey: getEnvVarOrFail("CQ_ORG_PRIVATE_KEY_PRODUCTION"),
      privateKeyPassword: getEnvVarOrFail("CQ_ORG_PRIVATE_KEY_PASSWORD_PRODUCTION"),
      certChain: getEnvVarOrFail("CQ_ORG_CERTIFICATE_INTERMEDIATE_PRODUCTION"),
    };

    const xmlResponses = createAndSignBulkDQRequests({
      bulkBodyData: [dqRequest],
      samlCertsAndKeys,
    });

    const response = await sendSignedDQRequests({
      signedRequests: xmlResponses,
      samlCertsAndKeys,
      patientId: dqRequest.patientId,
      cxId: dqRequest.cxId,
    });

    return processDQResponse({
      dqResponse: response[0],
    });
  } catch (error) {
    console.log("Erroring dqRequest", dqRequest);
    throw error;
  }
}

export async function main() {
  await DQIntegrationTest();
}

main();

/* 
TODO:
- compare by size, content, type and date, and total number of documents
- date format in db is this "creation": "2023-08-25T03:59:21", but here is this:   creation: 20230825155925,
- document unique ids are not constant

*/
