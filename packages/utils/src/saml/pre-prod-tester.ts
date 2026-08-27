import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { setS3UtilsInstance as setS3UtilsInstanceForStoringIheResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/monitor/store";
import {
  sendProcessRetryDrRequest,
  sendProcessXcpdRequest,
} from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/ihe-gateway-v2-logic";
import { createAndSignBulkDQRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/create/iti38-envelope";
import { createAndSignBulkDRRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/create/iti39-envelope";
import { processDqResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/process/dq-response";
import { setS3UtilsInstance as setS3UtilsInstanceForStoringDrResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/process/dr-response";
import { sendSignedDqRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/send/dq-requests";
import { createAndSignBulkXCPDRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xcpd/create/iti55-envelope";
import { setRejectUnauthorized } from "@metriport/core/external/carequality/ihe-gateway-v2/saml/saml-client";
import { isEhexSuccessfulOutboundPatientDiscoveryResponse } from "@metriport/core/external/ehex/ehex-gateway/outbound/xcpd/process/types";
import { Config } from "@metriport/core/util/config";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { initDbPool } from "@metriport/core/util/sequelize";
import {
  OutboundDocumentQueryReq,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalReq,
  OutboundDocumentRetrievalResp,
  OutboundPatientDiscoveryReq,
  OutboundPatientDiscoveryResp,
  OutboundPatientDiscoveryRespSuccessfulSchema,
  PatientResource,
} from "@metriport/ihe-gateway-sdk";
import { OutboundSamlAttributes } from "@metriport/ihe-gateway-sdk/models/shared";
import { QueryTypes } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { MockS3Utils } from "./mock-s3";

/** 
This script is a test script that queries the database for DQs and DRs, sends them to the Carequality gateway, and processes the responses.
It is being used to test that DQs and DRs do not have runtime errors, and to test that the responses are returning similar responses to those in 
the db.
*/

setRejectUnauthorized(false);
const s3utils = new MockS3Utils(Config.getAWSRegion());
setS3UtilsInstanceForStoringDrResponse(s3utils);
setS3UtilsInstanceForStoringIheResponse(s3utils);

const athenaOid = "2.16.840.1.113883.3.564.1";

const samlAttributes: OutboundSamlAttributes = {
  subjectId: "System User",
  subjectRole: {
    code: "106331006",
    display: "Administrative AND/OR managerial worker",
    system: "2.16.840.1.113883.6.96",
  },
  organization: "Metriport",
  organizationId: "2.16.840.1.113883.3.9621",
  homeCommunityId: "2.16.840.1.113883.3.9621",
  purposeOfUse: "TREATMENT",
  wsaFrom: "https://mock.com/soap/iti55",
};

type QueryResult = {
  url_dr: string;
};

async function queryDatabaseForXcpds() {
  const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
  const sequelize = initDbPool(sqlDBCreds);
  const query = `
    SELECT dqr.data
    FROM patient_discovery_result dqr
    WHERE dqr.status = 'success'
    ORDER BY RANDOM()
    LIMIT 5;
  `;

  try {
    const results = await sequelize.query(query, {
      type: QueryTypes.SELECT,
    });
    return results;
  } catch (error) {
    console.error("Error executing SQL query:", error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

async function queryDatabaseForDQs() {
  const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
  const sequelize = initDbPool(sqlDBCreds);
  const query = `
    SELECT dqr.data
    FROM document_query_result dqr
    WHERE dqr.status = 'success'
    ORDER BY RANDOM()
    LIMIT 5;
  `;

  try {
    const results = await sequelize.query(query, {
      type: QueryTypes.SELECT,
    });
    return results;
  } catch (error) {
    console.error("Error executing SQL query:", error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

export async function queryDatabaseForDqsFromFailedDrs() {
  const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
  const sequelize = initDbPool(sqlDBCreds);
  const query = `
    SELECT dqr.data
    FROM document_retrieval_result drr
    JOIN document_query_result dqr ON drr.request_id = dqr.request_id
    WHERE drr.status = 'failure'
    AND dqr.status = 'success'
    AND drr.data->'gateway'->>'homeCommunityId' = '${athenaOid}'
    AND dqr.data->'gateway'->>'homeCommunityId' = '${athenaOid}'
    ORDER BY RANDOM()
    LIMIT 10;
  `;
  try {
    const results = await sequelize.query(query, {
      type: QueryTypes.SELECT,
    });
    return results;
  } catch (error) {
    console.error("Error executing SQL query:", error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

async function getDrUrl(id: string): Promise<string> {
  const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
  const sequelize = initDbPool(sqlDBCreds);
  const query = `
    SELECT cde.url_dr
    FROM cq_directory_entry_view cde
    WHERE cde.id = :id;
  `;
  try {
    const results = await sequelize.query<QueryResult>(query, {
      replacements: { id },
      type: QueryTypes.SELECT,
    });
    return results[0].url_dr;
  } catch (error) {
    console.log("Error executing SQL query:", error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

function isSuccessfulResponse(
  response: OutboundPatientDiscoveryResp
): response is OutboundPatientDiscoveryRespSuccessfulSchema {
  return response.patientMatch === true && "patientResource" in response;
}

const DEFAULT_PATIENT_RESOURCE: PatientResource = {
  name: [],
  birthDate: "",
  gender: "unknown",
};

function extractPatientResource(xcpdResult: OutboundPatientDiscoveryResp): PatientResource {
  if (isEhexSuccessfulOutboundPatientDiscoveryResponse(xcpdResult)) {
    return xcpdResult.patientMatches[0]?.patientResource ?? DEFAULT_PATIENT_RESOURCE;
  }
  if (isSuccessfulResponse(xcpdResult)) {
    if ("patientResources" in xcpdResult && Array.isArray(xcpdResult.patientResources)) {
      return xcpdResult.patientResources[0] ?? DEFAULT_PATIENT_RESOURCE;
    }
    return xcpdResult.patientResource;
  }
  return DEFAULT_PATIENT_RESOURCE;
}

async function XcpdIntegrationTest() {
  let successCount = 0;
  let failureCount = 0;
  let runTimeErrorCount = 0;

  console.log("Querrying DB for Xcpds...");
  const results = await queryDatabaseForXcpds();
  console.log("Sending Xcpds...");
  const promises = results.map(async result => {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const xcpdResult = (result as any).data as OutboundPatientDiscoveryResp;
    if (!xcpdResult.cxId || !xcpdResult.patientId) {
      console.log("Skipping: ", xcpdResult.id);
      return undefined;
    }

    const patientResource = extractPatientResource(xcpdResult);

    const xcpdRequest: OutboundPatientDiscoveryReq = {
      id: xcpdResult.id,
      cxId: xcpdResult.cxId,
      gateways: [xcpdResult.gateway],
      timestamp: xcpdResult.timestamp,
      patientId: xcpdResult.patientId,
      samlAttributes: samlAttributes,
      patientResource,
      principalCareProviderIds: [""],
    };
    try {
      const xcpdResponse = await queryXcpd(xcpdRequest);
      return { xcpdRequest, xcpdResponse };
    } catch (error) {
      console.error("Runtime error:", error);
      throw error;
    }
  });

  console.log("Processing Xcpds...");
  const responses = await Promise.allSettled(promises);
  responses.forEach(response => {
    if (response.status === "fulfilled" && response.value) {
      const { xcpdRequest, xcpdResponse } = response.value;

      if (
        xcpdResponse.patientMatch === true ||
        xcpdResponse.operationOutcome?.issue[0].code === "not-found"
      ) {
        successCount++;
      } else {
        console.log("FAILURE");
        console.log("Xcpd response", JSON.stringify(xcpdResponse, null, 2));
        console.log("Xcpd request", JSON.stringify(xcpdRequest, null, 2));
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
  console.log(`Xcpd Success Count: ${successCount}`);
  console.log(`Xcpd Failure Count: ${failureCount}`);
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
      samlAttributes: samlAttributes,
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
      const responseDocumentReferences = new Set(
        dqResponse?.documentReference?.map(doc => `${doc.repositoryUniqueId}-${doc.docUniqueId}`)
      );

      if (responseDocumentReferences.size > 0) {
        successCount++;
      } else {
        console.log("FAILURE");
        console.log("dq response", JSON.stringify(dqResponse, null, 2));
        console.log("dq request", JSON.stringify(dqResult, null, 2));
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
  const results = await queryDatabaseForDqsFromFailedDrs();
  console.log("Sending DQs and DRs...");
  const promises = results.map(async result => {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dqResult = (result as any).data as OutboundDocumentQueryResp;
    if (
      !dqResult.cxId ||
      !dqResult.patientId ||
      !dqResult.documentReference ||
      !dqResult.externalGatewayPatient
    ) {
      console.log("Skipping: ", dqResult.id);
      return undefined;
    }

    const dqRequest: OutboundDocumentQueryReq = {
      id: dqResult.id,
      cxId: dqResult.cxId,
      gateway: dqResult.gateway,
      timestamp: dqResult.timestamp,
      patientId: dqResult.patientId,
      samlAttributes: samlAttributes,
      externalGatewayPatient: dqResult.externalGatewayPatient,
    };
    const dqResponse = await queryDQ(dqRequest);
    if (!dqResponse.documentReference) {
      console.log("No document references found for DQ: ", dqRequest.id);
      return undefined;
    }

    const drUrl = await getDrUrl(dqResult.gateway.homeCommunityId);

    const drRequest: OutboundDocumentRetrievalReq = {
      id: dqResult.id,
      cxId: dqResult.cxId,
      timestamp: dqResult.timestamp,
      gateway: {
        url: drUrl,
        homeCommunityId: dqResult.gateway.homeCommunityId,
      },
      patientId: dqResult.patientId,
      samlAttributes: samlAttributes,
      documentReference: dqResponse.documentReference.map(doc => ({
        ...doc,
        metriportId: uuidv4(),
      })),
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

async function queryXcpd(
  xcpdRequest: OutboundPatientDiscoveryReq
): Promise<OutboundPatientDiscoveryResp> {
  try {
    const samlCertsAndKeys = {
      publicCert: getEnvVarOrFail("CQ_ORG_CERTIFICATE_PRODUCTION"),
      privateKey: getEnvVarOrFail("CQ_ORG_PRIVATE_KEY_PRODUCTION"),
      privateKeyPassword: getEnvVarOrFail("CQ_ORG_PRIVATE_KEY_PASSWORD_PRODUCTION"),
      certChain: getEnvVarOrFail("CQ_ORG_CERTIFICATE_INTERMEDIATE_PRODUCTION"),
    };

    const signedRequests = createAndSignBulkXCPDRequests(xcpdRequest, samlCertsAndKeys);

    const resultPromises = signedRequests.map(async (signedRequest, index) => {
      return sendProcessXcpdRequest({
        signedRequest,
        samlCertsAndKeys,
        patientId: uuidv4(),
        cxId: uuidv4(),
        index,
      });
    });
    const results = await Promise.all(resultPromises);
    return results[0];
  } catch (error) {
    console.log("Erroring xcpdRequest", xcpdRequest);
    throw error;
  }
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

    const response = await sendSignedDqRequest({
      request: xmlResponses[0],
      samlCertsAndKeys,
      patientId: dqRequest.patientId,
      cxId: dqRequest.cxId,
      index: 0,
    });

    return processDqResponse({
      response,
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

    const signedRequests = createAndSignBulkDRRequests({
      bulkBodyData: [drRequest],
      samlCertsAndKeys,
    });

    const resultPromises = signedRequests.map(async (signedRequest, index) => {
      return sendProcessRetryDrRequest({
        signedRequest,
        samlCertsAndKeys,
        patientId: uuidv4(),
        cxId: uuidv4(),
        index,
      });
    });
    const results = await Promise.all(resultPromises);
    return results[0];
  } catch (error) {
    console.log("Erroring drRequest", drRequest);
    throw error;
  }
}

export async function main() {
  await XcpdIntegrationTest();
  await DQIntegrationTest();
  await DRIntegrationTest();
}

main();
