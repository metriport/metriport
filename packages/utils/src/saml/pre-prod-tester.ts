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
  const homeCommunityId = "1.2.840.114350.1.13.266.2.7.3.688884.100";
  const query = `
    SELECT dqr.data
    FROM document_query_result dqr
    WHERE dqr.status = 'success'
      AND dqr.data->'gateway'->>'homeCommunityId' = :homeCommunityId
    ORDER BY dqr.id DESC
    LIMIT 1;
  `;

  const replacements = { homeCommunityId };

  try {
    const results = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT,
    });
    return results;
  } catch (error) {
    console.error("Error executing query:", error);
    throw error; // Rethrow to handle it in the calling function
  }
}

async function integrationTest() {
  try {
    const results = await queryDatabase();
    for (const result of results) {
      //eslint-disable-next-line
      const dqResult = (result as any).data as OutboundDocumentQueryResp;
      if (!dqResult.cxId || !dqResult.patientId || !dqResult.externalGatewayPatient) {
        console.log("skipping: ", dqResult.id);
        continue;
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
      console.log("DQ response:", dqResponse);
      const resultDocumentReferences = new Set(
        dqResult.documentReference?.map(doc => `${doc.repositoryUniqueId}-${doc.docUniqueId}`)
      );
      const responseDocumentReferences = new Set(
        dqResponse.documentReference?.map(doc => `${doc.repositoryUniqueId}-${doc.docUniqueId}`)
      );
      console.log("Result document references:", resultDocumentReferences);
      console.log("Response document references:", responseDocumentReferences);

      const missingDocumentReferences = [...resultDocumentReferences].filter(
        ref => !responseDocumentReferences.has(ref)
      );

      if (missingDocumentReferences.length > 0) {
        console.log("Missing document references:", missingDocumentReferences);
      } else {
        console.log("No missing document references. BIG SUCCESS");
      }
    }
  } catch (error) {
    console.error("Error in fetchData:", error);
  }
}

async function queryDQ(dqRequest: OutboundDocumentQueryReq): Promise<OutboundDocumentQueryResp> {
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
}

export async function main() {
  await integrationTest();
}

main();

/* 
TODO:
- compare by size, content, type and date, and total number of documents
- date format in db is this "creation": "2023-08-25T03:59:21", but here is this:   creation: 20230825155925,
- document unique ids are not constant

*/
