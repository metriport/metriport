import * as dotenv from "dotenv";
dotenv.config();
import { initDbPool } from "@metriport/core/util/sequelize";
import { QueryTypes } from "sequelize";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import {
  OutboundDocumentQueryResp,
  OutboundDocumentQueryReq,
  OutboundDocumentRetrievalReq,
  OutboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";
import { createAndSignBulkDQRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/create/iti38-envelope";
import { sendSignedDQRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/send/dq-requests";
import { processDQResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/process/dq-response";
import { createAndSignBulkDRRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/create/iti39-envelope";
import { sendSignedDRRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/send/dr-requests";
import { processDRResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/process/dr-response";
import { Config } from "@metriport/core/util/config";
import { MockS3Utils } from "./s3";

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

async function queryDatabaseForDQs() {
  const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
  const sequelize = initDbPool(sqlDBCreds);
  const query = `
    SELECT dqr.data
    FROM document_query_result dqr
    WHERE dqr.status = 'success'
    ORDER BY RANDOM()
    LIMIT 1;
  `;

  try {
    const results = await sequelize.query(query, {
      type: QueryTypes.SELECT,
    });
    sequelize.close();
    return results;
  } catch (error) {
    console.error("Error executing SQL query:", error);
    sequelize.close();
    throw error;
  }
}

interface QueryResult {
  url_dr: string;
}

async function getDrUrl(id: string): Promise<string> {
  const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
  const sequelize = initDbPool(sqlDBCreds);
  const query = `
    SELECT cde.url_dr
    FROM cq_directory_entry cde
    WHERE cde.id = :id;
  `;

  console.log("ID: ", id);
  try {
    const results = await sequelize.query<QueryResult>(query, {
      replacements: { id },
      type: QueryTypes.SELECT,
    });
    sequelize.close();
    console.log("DR URL: ", results);
    return results[0].url_dr;
  } catch (error) {
    console.error("Error executing SQL query:", error);
    sequelize.close();
    throw error;
  }
}

async function DQIntegrationTest() {
  let successCount = 0;
  let failureCount = 0;
  let runTimeErrorCount = 0;

  const results = await queryDatabaseForDQs();
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

async function DRIntegrationTest() {
  let successCount = 0;
  let failureCount = 0;
  let runTimeErrorCount = 0;

  console.log("Querrying DB for DQs...");
  const results = await queryDatabaseForDQs();
  console.log("Sending DQs and DRs...");
  const promises = results.map(async result => {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dqResult = (result as any).data as OutboundDocumentQueryResp;
    if (!dqResult.cxId || !dqResult.patientId || !dqResult.externalGatewayPatient) {
      console.log("Skipping: ", dqResult);
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
    const dqResponse = await queryDQ(dqRequest);

    if (!dqResponse.documentReference) {
      console.log("No document references found for DQ: ", dqRequest, dqResponse);
      return undefined;
    }

    const drUrl = await getDrUrl(dqResult.gateway.homeCommunityId);
    console.log("DR URL: ", drUrl);

    const drRequest: OutboundDocumentRetrievalReq = {
      id: dqResult.id,
      cxId: dqResult.cxId,
      timestamp: dqResult.timestamp,
      gateway: {
        url: drUrl,
        homeCommunityId: dqResult.gateway.homeCommunityId,
      },
      patientId: dqResult.patientId,
      samlAttributes: samlAtributes,
      documentReference: dqResponse.documentReference,
    };
    try {
      const drResponse = await queryDR(drRequest);
      return { drRequest, drResponse };
    } catch (error) {
      console.error("Runtime error:", error);
      throw error;
    }
  });

  console.log("Processing DRs...");
  const responses = await Promise.allSettled(promises);
  responses.forEach(response => {
    if (response.status === "fulfilled" && response.value) {
      const { drRequest, drResponse } = response.value;
      const responseDocumentReferences = new Set(
        drResponse?.documentReference?.map(doc => `${doc.repositoryUniqueId}-${doc.docUniqueId}`)
      );

      if (responseDocumentReferences.size > 0) {
        successCount++;
        console.log("dr response", drResponse);
      } else {
        failureCount++;
        console.log("dr response", JSON.stringify(drResponse, null, 2));
        console.log("dr request", JSON.stringify(drRequest, null, 2));
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

async function queryDR(
  drRequest: OutboundDocumentRetrievalReq
): Promise<OutboundDocumentRetrievalResp> {
  try {
    const samlCertsAndKeys = {
      publicCert: getEnvVarOrFail("CQ_ORG_CERTIFICATE_PRODUCTION"),
      privateKey: getEnvVarOrFail("CQ_ORG_PRIVATE_KEY_PRODUCTION"),
      privateKeyPassword: getEnvVarOrFail("CQ_ORG_PRIVATE_KEY_PASSWORD_PRODUCTION"),
      certChain: getEnvVarOrFail("CQ_ORG_CERTIFICATE_INTERMEDIATE_PRODUCTION"),
    };

    const xmlResponses = createAndSignBulkDRRequests({
      bulkBodyData: [drRequest],
      samlCertsAndKeys,
    });

    const response = await sendSignedDRRequests({
      signedRequests: xmlResponses,
      samlCertsAndKeys,
      patientId: drRequest.patientId,
      cxId: drRequest.cxId,
    });

    const s3Utils = new MockS3Utils(Config.getAWSRegion());
    return processDRResponse({
      drResponse: response[0],
      s3Utils,
    });
  } catch (error) {
    console.log("Erroring drRequest", drRequest);
    throw error;
  }
}

export async function main() {
  await DQIntegrationTest();
  await DRIntegrationTest();
}

main();

/* 
TODO:
- compare by size, content, type and date, and total number of documents
- date format in db is this "creation": "2023-08-25T03:59:21", but here is this:   creation: 20230825155925,
- document unique ids are not constant

*/