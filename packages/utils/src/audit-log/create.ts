import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { AuditLogServiceLocal } from "@metriport/core/audit-log/audit-log-service-local";
import {
  buildInboundDocumentQueryAuditEvent,
  buildInboundDocumentRetrievalAuditEvent,
  buildInboundPatientDiscoveryAuditEvent,
  buildOutboundDocumentQueryAuditEvent,
  buildOutboundDocumentRetrievalAuditEvent,
  buildOutboundPatientDiscoveryAuditEvent,
  Source,
} from "@metriport/core/audit-log/index";
import { AuditEventOutcome, NetworkAccessPointTypeCode } from "@metriport/core/audit-log/types";
import { SignedDqRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/create/iti38-envelope";
import { XCPDSamlClientResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xcpd/send/xcpd-requests";
import { SignedXcpdRequest } from "@metriport/core/external/ehex/ehex-gateway/outbound/xcpd/create/iti55-envelope";
import { SignedDrRequest } from "@metriport/core/external/ehex/ehex-gateway/outbound/xca/create/iti39-envelope";
import { out } from "@metriport/core/util/log";
import {
  DocumentReference,
  InboundDocumentQueryReq,
  InboundDocumentQueryResp,
  InboundDocumentRetrievalReq,
  InboundDocumentRetrievalResp,
  InboundPatientDiscoveryReq,
  InboundPatientDiscoveryResp,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp,
  PatientResource,
  XCAGateway,
} from "@metriport/ihe-gateway-sdk";
import { getEnvVar, sleep, uuidv7 } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { Command } from "commander";
import { customAlphabet } from "nanoid";
import { elapsedTimeAsStr } from "../shared/duration";
import {
  buildPathInsideRunsFolder,
  getTimestampForFilename,
  initRunsFolder,
} from "../shared/folder";

/**
 * This script creates audit log events so we can validate their format. They are
 * stored in the runs folder.
 *
 * Currently it creates:
 * - Outbound Patient Discovery Audit Event
 * - Inbound Patient Discovery Audit Event
 * - Outbound Document Query (ITI-38) Audit Event
 * - Inbound Document Query (ITI-38) Audit Event
 * - Outbound Document Retrieval (ITI-39) Audit Event
 * - Inbound Document Retrieval (ITI-39) Audit Event
 *
 * Usage:
 * - run it
 *   - ts-node src/audit-log/create
 */

const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

const cxId = getEnvVar("CX_ID") ?? "cxid_" + nanoid();
const patientId = uuidv7();
const externalPatientId =
  "MzY4NjVjMTctNzk4Ny00NzdlLTlmY2ItNzA3YjNhYzcwNDJmLzAxOWFiZDc3LTNhYzYtNzZmZi04ZjFmLWMzMTQxOTg1MTc1Yw==^^^&2.16.840.1.113883.3.9621&ISO";

const folderName = buildPathInsideRunsFolder(`audit-log`) + `/${getTimestampForFilename()}`;
initRunsFolder(folderName);

const program = new Command();
program
  .name("create")
  .description("CLI to create audit log events for development and testing")
  .showHelpAfterError()
  .action(main)
  .parse();

async function main() {
  await sleep(50);
  const { log } = out("");

  const startedAt = Date.now();
  log(`>>> Starting at ${buildDayjs().toISOString()}...`);

  const patientResource: PatientResource = {
    id: patientId,
    birthDate: " 1900-01-01 ",
    gender: "female",
    name: [
      {
        family: "Smith",
        given: ["Katherine", "Katy "],
      },
    ],
    address: [
      {
        line: ["400 Awesome Road"],
        city: "San Francisco",
        state: "CA",
        postalCode: "99999-4040",
      },
      {
        line: ["401 Awesome Rd.", "Apt 1b"],
        city: "San Francisco ",
        state: "CA",
        postalCode: "99999",
        country: "USA",
      },
    ],
    telecom: [
      {
        system: "phone",
        value: "(888)8887777",
      },
      {
        value: "(888)8886666",
      },
      {
        system: "email",
        value: " katy2020@GMAIL.COM",
      },
      {
        value: " queenkaty2020@GMAIL.COM",
      },
    ],
    identifier: [],
  };

  await createOutboundPatientDiscovery(folderName, patientResource, cxId);

  await createInboundPatientDiscovery(folderName, patientResource);

  await createOutboundDocumentQuery(folderName, cxId);

  await createInboundDocumentQuery(folderName);

  await createOutboundDocumentRetrieval(folderName, cxId);

  await createInboundDocumentRetrieval(folderName);

  log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

async function createOutboundPatientDiscovery(
  folderName: string,
  patientResource: PatientResource,
  cxId: string
): Promise<void> {
  const outboundPdRequest: SignedXcpdRequest = {
    gateway: {
      oid: "gateway-oid",
      url: "http://external-gateway-url.com/v1/patient-discovery",
      id: "gateway-homecommunityid",
    },
    signedRequest: "signed-request",
    queryByParameterXml: pdQueryParamInXml,
    outboundRequest: {
      id: uuidv7(),
      timestamp: buildDayjs().toISOString(),
      samlAttributes: {
        subjectId: "john@example.com",
        subjectRole: {
          display: "Physician",
          code: "309343006",
          system: "2.16.840.1.113883.6.96",
        },
        organization: "Service Organization Name",
        organizationId: "serviceOrganizationId",
        homeCommunityId: "urn:oid:serviceHomeCommunityId",
        wsaFrom: "urn:oid:serviceHomeCommunityIdOnWsaFrom",
        purposeOfUse: "TREATMENT",
      },
      patientResource,
      gateways: [
        {
          url: "https://destination.server.com/v1/patient-discovery",
          oid: "destination-oid",
          id: "destination-id",
        },
      ],
      principalCareProviderIds: ["principal-care-prov-id"],
      patientId,
      cxId,
    },
  };
  const outboundPdResponse: XCPDSamlClientResponse = {
    response: "the-response",
    success: true,
    gateway: outboundPdRequest.gateway,
    outboundRequest: outboundPdRequest.outboundRequest,
  };

  const auditEvent = buildOutboundPatientDiscoveryAuditEvent({
    appInstanceId: "app-instance-id",
    networkName: Source.HIE_EHEX,
    request: outboundPdRequest,
    isPatientMatch: outboundPdResponse.success,
    patientId,
    cxId,
    startTime: buildDayjs(outboundPdRequest.outboundRequest.timestamp).toDate(),
    endTime: buildDayjs().toDate(),
    statusCode: 200,
    outcome: AuditEventOutcome.Success,
    outcomeDesc: "Success",
    query: pdQueryParamInXml,
  });

  const auditLogService = new AuditLogServiceLocal();
  AuditLogServiceLocal.setFolderName(folderName);
  await auditLogService.ingestAuditLog(auditEvent);
}

async function createInboundPatientDiscovery(
  folderName: string,
  patientResource: PatientResource
): Promise<void> {
  const inboundPdRequest: InboundPatientDiscoveryReq = {
    id: uuidv7(),
    timestamp: buildDayjs().toISOString(),
    samlAttributes: {
      wsaFrom: "urn:oid:initiatorHomeCommunityId",
      subjectId: "john@example.com",
      subjectRole: {
        display: "Physician",
        code: "309343006",
        system: "2.16.840.1.113883.6.96",
      },
      organization: "initiator Organization Name",
      organizationId: "initiator-organization-id",
      homeCommunityId: "urn:oid:initiatorHomeCommunityId",
      purposeOfUse: "TREATMENT",
    },
    patientResource,
  };
  const patientId = patientResource.id;
  const patientMatch = patientId ? true : false;
  const inboundPdResponse: InboundPatientDiscoveryResp = {
    id: inboundPdRequest.id,
    timestamp: buildDayjs().toISOString(),
    responseTimestamp: buildDayjs().toISOString(),
    patientMatch,
    gatewayHomeCommunityId: "gateway-home-community-id",
    patientId,
    patientMatchDegree: patientMatch ? 0.95 : 0.22,
    patientResource: inboundPdRequest.patientResource,
    externalGatewayPatient: {
      id: "MzY4NjVjMTctNzk4Ny00NzdlLTlmY2ItNzA3YjNhYzcwNDJmLzAxOWFiZDc3LTNhYzYtNzZmZi04ZjFmLWMzMTQxOTg1MTc1Yw==^^^&2.16.840.1.113883.3.9621&ISO",
      system: "external-system",
    },
  };

  const startTime = buildDayjs().toDate();
  const endTime = buildDayjs().toDate();

  const auditEvent = buildInboundPatientDiscoveryAuditEvent({
    appInstanceId: "app-instance-id",
    networkName: Source.HIE_EHEX,
    request: inboundPdRequest,
    initiatorAddress: {
      type: NetworkAccessPointTypeCode.IpAddress,
      address: "192.168.1.1",
    },
    destinationAddress: {
      type: NetworkAccessPointTypeCode.DnsName,
      address: "http://our.server.com/v1/patient-discovery",
    },
    query: pdQueryParamInXml,
    startTime,
    endTime,
    response: inboundPdResponse,
    statusCode: 200,
    outcomeDesc: "Success",
  });

  const auditLogService = new AuditLogServiceLocal();
  AuditLogServiceLocal.setFolderName(folderName);
  await auditLogService.ingestAuditLog(auditEvent);
}

async function createOutboundDocumentQuery(folderName: string, cxId: string): Promise<void> {
  const gateway: XCAGateway = {
    homeCommunityId: "gateway-oid",
    actualHomeCommunityId: "gateway-homecommunityid",
    url: "http://external-gateway-url.com/v1/document-query",
  };
  const outboundDqRequest: SignedDqRequest = {
    signedRequest: "signed-request",
    gateway,
    outboundRequest: {
      id: uuidv7(),
      timestamp: buildDayjs().toISOString(),
      samlAttributes: {
        subjectId: "subjectId",
        subjectRole: {
          display: "Physician",
          code: "309343006",
          system: "2.16.840.1.113883.6.96",
        },
        organization: "Service Organization Name",
        organizationId: "serviceOrganizationId",
        homeCommunityId: "urn:oid:serviceHomeCommunityId",
        wsaFrom: "urn:oid:serviceHomeCommunityIdOnWsaFrom",
        purposeOfUse: "TREATMENT",
      },
      externalGatewayPatient: {
        id: externalPatientId,
        system: "external-system",
      },
      gateway,
      patientId,
      cxId,
    },
  };
  const outboundDqResponse: OutboundDocumentQueryResp = {
    id: outboundDqRequest.outboundRequest.id,
    timestamp: outboundDqRequest.outboundRequest.timestamp,
    responseTimestamp: buildDayjs().toISOString(),
    documentReference: [
      {
        homeCommunityId: "home-community-id",
        docUniqueId: "doc-unique-id",
        repositoryUniqueId: "repository-unique-id",
      },
    ],
    gateway: outboundDqRequest.gateway,
  };

  const startTime = buildDayjs().toDate();
  const endTime = buildDayjs().toDate();

  const auditEvent = buildOutboundDocumentQueryAuditEvent({
    appInstanceId: "app-instance-id",
    networkName: Source.HIE_EHEX,
    request: outboundDqRequest,
    response: outboundDqResponse,
    patientId,
    cxId,
    startTime,
    endTime,
    query: pdQueryParamInXml,
    outcome: AuditEventOutcome.Success,
    outcomeDesc: "Success",
  });

  const auditLogService = new AuditLogServiceLocal();
  AuditLogServiceLocal.setFolderName(folderName);
  await auditLogService.ingestAuditLog(auditEvent);
}

async function createInboundDocumentQuery(folderName: string): Promise<void> {
  const inboundDqRequest: InboundDocumentQueryReq = {
    id: uuidv7(),
    timestamp: buildDayjs().toISOString(),
    samlAttributes: {
      wsaFrom: "urn:oid:initiatorHomeCommunityId",
      subjectId: "john@example.com",
      subjectRole: {
        display: "Physician",
        code: "309343006",
        system: "2.16.840.1.113883.6.96",
      },
      organization: "initiator Organization Name",
      organizationId: "initiator-organization-id",
      homeCommunityId: "urn:oid:initiatorHomeCommunityId",
      purposeOfUse: "TREATMENT",
    },
    externalGatewayPatient: {
      id: "MzY4NjVjMTctNzk4Ny00NzdlLTlmY2ItNzA3YjNhYzcwNDJmLzAxOWFiZDc3LTNhYzYtNzZmZi04ZjFmLWMzMTQxOTg1MTc1Yw==^^^&2.16.840.1.113883.3.9621&ISO",
      system: "external-system",
    },
  };
  const inboundDqResponse: InboundDocumentQueryResp = {
    id: inboundDqRequest.id,
    timestamp: buildDayjs().toISOString(),
    responseTimestamp: buildDayjs().toISOString(),
    patientId,
    extrinsicObjectXmls: [
      "<extrinsicObject>doc1</extrinsicObject>",
      "<extrinsicObject>doc2</extrinsicObject>",
    ],
  };

  const startTime = buildDayjs().toDate();
  const endTime = buildDayjs().toDate();

  const auditEvent = buildInboundDocumentQueryAuditEvent({
    appInstanceId: "app-instance-id",
    networkName: Source.HIE_EHEX,
    initiatorAddress: {
      type: NetworkAccessPointTypeCode.IpAddress,
      address: "192.168.1.1",
    },
    destinationAddress: {
      type: NetworkAccessPointTypeCode.DnsName,
      address: "http://our.server.com/v1/document-query",
    },
    request: inboundDqRequest,
    response: inboundDqResponse,
    statusCode: 200,
    startTime,
    endTime,
    query: pdQueryParamInXml,
  });

  const auditLogService = new AuditLogServiceLocal();
  AuditLogServiceLocal.setFolderName(folderName);
  await auditLogService.ingestAuditLog(auditEvent);
}

async function createOutboundDocumentRetrieval(folderName: string, cxId: string): Promise<void> {
  const gateway: XCAGateway = {
    homeCommunityId: "gateway-oid",
    actualHomeCommunityId: "gateway-homecommunityid",
    url: "http://external-gateway-url.com/v1/document-retrieval",
  };
  const outboundDrRequest: SignedDrRequest = {
    gateway,
    signedRequest: "signed-request",
    outboundRequest: {
      id: uuidv7(),
      timestamp: buildDayjs().toISOString(),
      samlAttributes: {
        subjectId: "subjectId",
        subjectRole: {
          display: "display",
          code: "code",
          system: "2.16.840.1.113883.6.96",
        },
        organization: "Service Organization Name",
        organizationId: "serviceOrganizationId",
        homeCommunityId: "urn:oid:serviceHomeCommunityId",
        wsaFrom: "urn:oid:serviceHomeCommunityIdOnWsaFrom",
        purposeOfUse: "TREATMENT",
      },
      documentReference: [
        {
          homeCommunityId: "docref-home-community-id-req",
          docUniqueId: "docref-doc-unique-id-req",
          repositoryUniqueId: "docref-repository-unique-id-req",
        },
      ],
      gateway: {
        homeCommunityId: "gateway-home-community-id",
        url: "http://external-gateway-url.com/v1/document-retrieval",
      },
      patientId,
      externalPatientId,
      cxId,
    },
  };
  const outboundDrResponse: OutboundDocumentRetrievalResp = {
    id: outboundDrRequest.outboundRequest.id,
    timestamp: outboundDrRequest.outboundRequest.timestamp,
    responseTimestamp: buildDayjs().toISOString(),
    documentReference: [
      {
        homeCommunityId: "docref-home-community-id-resp",
        docUniqueId: "docref-doc-unique-id-resp",
        repositoryUniqueId: "docref-repository-unique-id-resp",
      },
    ],
    gateway: outboundDrRequest.gateway,
  };

  const startTime = buildDayjs().toDate();
  const endTime = buildDayjs().toDate();

  const auditEvent = buildOutboundDocumentRetrievalAuditEvent({
    appInstanceId: "app-instance-id",
    networkName: Source.HIE_EHEX,
    request: outboundDrRequest,
    response: outboundDrResponse,
    patientId,
    cxId,
    startTime,
    endTime,
    outcome: AuditEventOutcome.Success,
    outcomeDesc: "Success",
  });

  const auditLogService = new AuditLogServiceLocal();
  AuditLogServiceLocal.setFolderName(folderName);
  await auditLogService.ingestAuditLog(auditEvent);
}

async function createInboundDocumentRetrieval(folderName: string): Promise<void> {
  const documentReference: DocumentReference = {
    homeCommunityId: "home-community-id",
    docUniqueId: "doc-unique-id",
    repositoryUniqueId: "repository-unique-id",
  };
  const inboundDrRequest: InboundDocumentRetrievalReq = {
    id: uuidv7(),
    timestamp: buildDayjs().toISOString(),
    samlAttributes: {
      wsaFrom: "urn:oid:initiatorHomeCommunityId",
      subjectId: "john@example.com",
      subjectRole: {
        display: "display",
        code: "code",
        system: "2.16.840.1.113883.6.96",
      },
      organization: "initiator Organization Name",
      organizationId: "initiator-organization-id",
      homeCommunityId: "urn:oid:initiatorHomeCommunityId",
      purposeOfUse: "TREATMENT",
    },
    documentReference: [documentReference],
  };
  const inboundDrResponse: InboundDocumentRetrievalResp = {
    id: inboundDrRequest.id,
    timestamp: buildDayjs().toISOString(),
    responseTimestamp: buildDayjs().toISOString(),
    patientId,
    documentReference: [documentReference],
  };

  const startTime = buildDayjs().toDate();
  const endTime = buildDayjs().toDate();

  const auditEvent = buildInboundDocumentRetrievalAuditEvent({
    appInstanceId: "app-instance-id",
    networkName: Source.HIE_EHEX,
    initiatorAddress: {
      type: NetworkAccessPointTypeCode.IpAddress,
      address: "192.168.1.1",
    },
    destinationAddress: {
      type: NetworkAccessPointTypeCode.DnsName,
      address: "http://our.server.com/v1/document-retrieval",
    },
    request: inboundDrRequest,
    response: inboundDrResponse,
    statusCode: 200,
    startTime,
    endTime,
  });

  const auditLogService = new AuditLogServiceLocal();
  AuditLogServiceLocal.setFolderName(folderName);
  await auditLogService.ingestAuditLog(auditEvent);
}

const pdQueryParamInXml = `
<queryByParameter>
    <queryId extension= "95792219-2c2f-4b31-8671-685da63689cc" root= "2.16.840.1.113883.3.7204.1.3.2.2" />
    <statusCode code= "new" />
    <responseModalityCode code= "R" />
    <responsePriorityCode code= "I" />
    <parameterList>
        <livingSubjectAdministrativeGender>
            <value code= "male" codeSystem= "2.16.840.1.113883.5.1" />
            <semanticsText>LivingSubject.administrativeGender</semanticsText>
        </livingSubjectAdministrativeGender>
        <livingSubjectBirthTime>
            <value value= "19800101" />
            <semanticsText>LivingSubject.birthTime</semanticsText>
        </livingSubjectBirthTime>
        <livingSubjectName>
            <value>
                <family>Doe</family>
                <give>John</give>
            </value>
            <semanticsText>LivingSubject.name</semanticsText>
        </livingSubjectName>
        <patientAddress>
            <value>
                <streetAddressLine>999 Last Rd</streetAddressLine>
                <city>Springfield</city>
                <state>MO</state>
                <postalCode>10001</postalCode>
                <country>USA</country>
            </value>
            <semanticsText>Patient.addr</semanticsText>
        </patientAddress>
        <patientTelecom>
            <value use= "HP" value= "tel:+1-417-989-3300" />
            <value use= "HP" value= "tel:+1-417-989-0987" />
            <semanticsText>Patient.telecom</semanticsText>
        </patientTelecom>
    </parameterList>
</queryByParameter>
`;

export default program;
