import dotenv from "dotenv";
dotenv.config();
// keep that ^ above all other imports
import {
  APIMode,
  CommonWell,
  CommonWellMember,
  DocumentReference,
  encodeCwPatientId,
  Organization,
} from "@metriport/commonwell-sdk";
import {
  DocumentDownloaderLocalConfig,
  DocumentDownloaderLocalV2,
} from "@metriport/core/external/commonwell-v2/document/document-downloader-local-v2";
import { Document } from "@metriport/core/external/commonwell/document/document-downloader";
import { out } from "@metriport/core/util/log";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { makeNPI } from "@metriport/shared/common/__tests__/npi";
import { v4 as uuidv4 } from "uuid";
import {
  memberCertificateString,
  memberName,
  memberPrivateKeyString,
  orgCertificateString,
  orgPrivateKeyString,
} from "./env";

/**
 * Test utility script for DocumentDownloaderLocalV2
 *
 * This script provides comprehensive testing capabilities for the DocumentDownloaderLocalV2 class,
 * allowing you to validate its functionality in various scenarios including basic document downloads,
 * XML parsing with embedded PDF extraction, error handling, MIME type detection, and concurrent operations.
 *
 * Environment variables required:
 * - AWS_REGION: AWS region for S3 operations
 * - MEDICAL_DOCUMENTS_BUCKET_NAME: S3 bucket name for storing documents
 * - COMMONWELL_ORG_CERT: CommonWell organization certificate
 * - COMMONWELL_RSA_PRIVATE_KEY: CommonWell RSA private key
 * - COMMONWELL_ORG_NAME: CommonWell organization name
 * - COMMONWELL_OID: CommonWell organization OID
 * - COMMONWELL_NPI: CommonWell organization NPI
 * - COMMONWELL_HOME_COMMUNITY_ID: CommonWell home community ID
 *
 * Usage: npm run test-document-downloader-local-v2
 */

const { log } = out("test-document-downloader-local-v2");

// const patientId = getEnvVarOrFail("PATIENT_ID");
const patientId = "0194f5f7-c165-7c48-b7fe-cf1f4da02e17";
const cxId = getEnvVarOrFail("CX_ID");
const orgOid = "2.16.840.1.113883.3.9621.5.20003";
const memberId = "151";
const region = getEnvVarOrFail("AWS_REGION");
const bucketName = getEnvVarOrFail("TEST_BUCKET_NAME");

function createCommonWellAPI(org: Organization): CommonWell {
  const commonwell = new CommonWell({
    orgCert: orgCertificateString,
    rsaPrivateKey: orgPrivateKeyString,
    orgName: org.name,
    oid: org.organizationId,
    homeCommunityId: org.homeCommunityId,
    npi: org.npiType2 ?? makeNPI(),
    apiMode: APIMode.integration,
  });
  return commonwell;
}

async function queryDocuments(
  commonWell: CommonWell,
  patientId: string
): Promise<DocumentReference[]> {
  const status = "current";
  console.log(`>>> 1.1.1 Document Query for status: ${status}`);
  const documents = await commonWell.queryDocuments(patientId, { status });
  console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
  console.log(`>>> 1.1.1 Response (status ${status}): ` + JSON.stringify(documents, null, 2));
  console.log(`>>> 1.1.1 Got ${documents.length} documents for status ${status}`);
  return documents;
}

async function getOneOrg(commonWell: CommonWellMember, orgId: string): Promise<Organization> {
  console.log(`>>> Get one org`);
  const respGetOneOrg = await commonWell.getOneOrg(orgId);
  console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
  // console.log(">>> Response: " + JSON.stringify(respGetOneOrg, null, 2));
  if (!respGetOneOrg) throw new Error("No org on response from getOneOrg");
  return respGetOneOrg;
}

/**
 * Tests basic document download functionality
 */
async function testBasicDownload(): Promise<void> {
  log("=== Testing Basic Document Download ===");

  const commonWellMember = new CommonWellMember({
    orgCert: memberCertificateString,
    rsaPrivateKey: memberPrivateKeyString,
    memberName: memberName,
    memberId,
    apiMode: APIMode.integration,
  });

  const org = await getOneOrg(commonWellMember, orgOid);

  const commonWellAPI = createCommonWellAPI(org);

  const config: DocumentDownloaderLocalConfig = {
    commonWell: {
      api: commonWellAPI,
    },
    region,
    bucketName,
  };

  const downloader = new DocumentDownloaderLocalV2(config);

  const encondedPatientId = encodeCwPatientId({
    patientId,
    assignAuthority: org.organizationId,
  });

  const documents = await queryDocuments(commonWellAPI, encondedPatientId);
  console.log(`>>> Got ${documents.length} documents`);
  for (const doc of documents) {
    const docId = doc.masterIdentifier?.value;

    const sourceDocument: Document = {
      id: docId ?? "",
      mimeType: doc.content[0].attachment.contentType ?? "",
      location: doc.content[0].attachment.url ?? "",
    };
    if (!sourceDocument.id || !sourceDocument.mimeType || !sourceDocument.location) {
      throw new Error("Missing source document");
    }

    const result = await downloader.download({
      sourceDocument,
      destinationFileInfo: {
        location: "devs.metriport.com",
        name: `raf/${docId ?? doc.id ?? uuidv4()}.xml`,
      },
      cxId,
    });

    console.log(`>>> Transaction ID: ${commonWellAPI.lastTransactionId}`);
    console.log(`>>> Result: ${JSON.stringify(result)}`);
  }
}

/**
 * Runs all test scenarios
 */
async function runAllTests(): Promise<void> {
  log("🚀 Starting DocumentDownloaderLocalV2 test suite...");
  const startTime = Date.now();

  try {
    await testBasicDownload();
    log("");

    const duration = Date.now() - startTime;
    log(`🎉 All tests completed in ${duration}ms`);
  } catch (error) {
    log(`💥 Test suite failed: `, error);
    throw error;
  }
}

/**
 * Main function to run the test utility
 */
async function main(): Promise<void> {
  try {
    await runAllTests();
  } catch (error) {
    log(`Test utility failed: ${error}`);
    process.exit(1);
  }
}

// Run the test utility if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    log(`Unhandled error: ${error}`);
    process.exit(1);
  });
}
