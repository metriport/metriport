import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { createInboundDqResponse } from "@metriport/core/external/ehex/ehex-gateway/inbound/xca/create/dq-response";
import { createInboundDrResponse } from "@metriport/core/external/ehex/ehex-gateway/inbound/xca/create/dr-response";
import { processInboundDr } from "@metriport/core/external/ehex/dr/process-inbound-dr";
import { processInboundDq } from "@metriport/core/external/ehex/ehex-gateway/inbound/xca/process/dq-request";
import { getEncodedDocumentIdFromMetadataXml } from "@metriport/core/shareback/metadata/get-metadata-xml";
import {
  InboundDocumentRetrievalReq,
  InboundDocumentRetrievalResp,
  InboundSpecificDocumentQueryReq,
  ON_DEMAND_DOCUMENT_TYPE_UUID,
} from "@metriport/ihe-gateway-sdk";
import { createPatientUniqueId, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { createXMLParser } from "@metriport/shared/common/xml-parser";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { elapsedTimeAsStr } from "../../shared/duration";
import { initRunsFolder } from "../../shared/folder";

dayjs.extend(duration);

/**
 * Script to trigger the processing of an inbound DQ/DR request FOR DEV PURPOSES ONLY.
 * It will run DQ and DR processing code so you can test/debug the inbound flow.
 * Make sure to update the cxId and patientId variables to the ones you want to test.
 */

// UPDATE THESE
const cxId = "";
const patientId = "";

const program = new Command();
program
  .name("inbound-process-dq-and-dr")
  .description("CLI to trigger the processing of an inbound DQ/DR request FOR DEV PURPOSES ONLY")
  .showHelpAfterError()
  .action(main);

async function main() {
  await sleep(50);
  initRunsFolder();

  const startedAt = Date.now();
  console.log(`>>> Starting at ${buildDayjs().toISOString()}...`);

  try {
    const homeCommunityId = "homeCommunityId-123";
    const encodedExternalPatientId = createPatientUniqueId(cxId, patientId);
    const params: InboundSpecificDocumentQueryReq = {
      id: "requestId-dq-123",
      timestamp: buildDayjs().toISOString(),
      samlAttributes: {
        homeCommunityId,
        subjectId: encodedExternalPatientId,
        subjectRole: {
          code: "subjectRoleCode-123",
          display: "subjectRoleDisplay-123",
          system: "subjectRoleSystem-123",
        },
        organization: "organization-123",
        organizationId: "organizationId-123",
        purposeOfUse: "purposeOfUse-123",
      },
      externalGatewayPatient: {
        id: encodedExternalPatientId,
        system: "system-123",
      },
      // documentType: [STABLE_DOCUMENT_TYPE_UUID],
      documentType: [ON_DEMAND_DOCUMENT_TYPE_UUID],
    };
    const dqResult = await processInboundDq(params);
    const dqXmlResponse = createInboundDqResponse(dqResult);
    console.log(`>>> DQ response: ${dqXmlResponse}`);

    if (dqResult.operationOutcome) {
      console.log(
        `>>> DQ operation outcome: ${JSON.stringify(dqResult.operationOutcome, null, 2)}`
      );
      process.exit(1);
    }

    if (!dqResult.extrinsicObjectXmls || dqResult.extrinsicObjectXmls.length < 1) {
      console.log(`>>> DQ returned no documents`);
      return;
    }

    const documentReferences =
      dqResult.extrinsicObjectXmls?.map(xml => {
        const parser = createXMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: "_",
          textNodeName: "_text",
          parseAttributeValue: false,
          removeNSPrefix: true,
        });
        const jsonObj = parser.parse(xml);
        const encodedDocumentId = getEncodedDocumentIdFromMetadataXml(jsonObj);
        return {
          homeCommunityId,
          docUniqueId: encodedDocumentId ?? "ERROR-UNKNOWN-ID",
          repositoryUniqueId: "123",
        };
      }) ?? [];
    const drRequest: InboundDocumentRetrievalReq = {
      id: "requestId-dr-456",
      timestamp: buildDayjs().toISOString(),
      samlAttributes: {
        homeCommunityId,
        subjectId: encodedExternalPatientId,
        subjectRole: {
          code: "subjectRoleCode-123",
          display: "subjectRoleDisplay-123",
          system: "subjectRoleSystem-123",
        },
        organization: "organization-123",
        organizationId: "organizationId-123",
        purposeOfUse: "purposeOfUse-123",
      },
      documentReference: documentReferences,
    };
    const drResult: InboundDocumentRetrievalResp = await processInboundDr(drRequest);
    const drXmlResponse = await createInboundDrResponse(drResult);
    console.log(`>>> DR response: ${drXmlResponse}`);
  } finally {
    console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
  }
}

program.parse();

export default program;
