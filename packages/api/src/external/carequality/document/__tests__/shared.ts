import { faker } from "@faker-js/faker";
import {
  OperationOutcome,
  OutboundDocumentQueryResp,
} from "@metriport/core/external/carequality/ihe-gateway-types";
import {
  BaseErrorResponse,
  BaseRequest,
  BaseResponse,
  Code,
  Details,
  Issue,
  SamlAttributes,
  XCAGateway,
  XCPDGateway,
  XCPDPatientId,
} from "@metriport/core/external/carequality/ihe-gateway-types";
import { makeDocumentReferenceWithMetriporId } from "./make-document-reference-with-metriport-id";

export type IdSystem = { id: string; system: string };

export function makeBaseRequest({
  id,
  cxId,
  timestamp,
  samlAttributes,
  patientId,
}: Partial<BaseRequest> = {}): BaseRequest {
  const _id = id ?? faker.string.uuid();
  const _cxId = cxId ?? faker.string.uuid();
  const _timestamp = timestamp ?? faker.date.recent().toISOString();
  const _samlAttributes = samlAttributes ?? makeSamlAttributes();
  const _patientId = patientId ?? faker.string.uuid();

  return {
    id: _id,
    cxId: _cxId,
    timestamp: _timestamp,
    samlAttributes: _samlAttributes,
    patientId: _patientId,
  };
}

export function makeCode({ system, code }: Partial<Code> = {}): Code {
  const _system = system ?? faker.lorem.word();
  const _code = code ?? faker.lorem.word();

  return {
    system: _system,
    code: _code,
  };
}
export function makeDetails(params: Partial<Details> = {}): Details {
  if ("text" in params) {
    return {
      text: params.text ?? faker.lorem.text(),
    };
  }
  const _coding = (params as { coding: Code[] }).coding;
  return {
    coding: _coding ?? [makeCode()],
  };
}

export function makeIssue({ severity, code, details }: Partial<Issue> = {}): Issue {
  const _severity = severity ?? faker.lorem.word();
  const _code = code ?? faker.lorem.word();
  const _details = details ?? makeDetails();

  return {
    severity: _severity,
    code: _code,
    details: _details,
  };
}

export function makeOperationOutcome({
  id,
  resourceType,
  issue,
}: Partial<OperationOutcome> = {}): OperationOutcome {
  const _id = id ?? faker.string.uuid();
  const _resourceType = resourceType ?? faker.lorem.word();
  const _issue = issue ?? [makeIssue()];

  return {
    id: _id,
    resourceType: _resourceType,
    issue: _issue,
  };
}

export function makeBaseResponse({
  id,
  timestamp,
  responseTimestamp,
  cxId,
  externalGatewayPatient,
  patientId,
  operationOutcome,
}: Partial<BaseResponse> = {}): BaseResponse {
  const _id = id ?? faker.string.uuid();
  const _timestamp = timestamp ?? faker.date.recent().toISOString();
  const _responseTimestamp = responseTimestamp ?? faker.date.recent().toISOString();
  const _cxId = cxId ?? faker.string.uuid();
  const _externalGatewayPatient = externalGatewayPatient ?? makeExternalGatewayPatient();
  const _patientId = patientId ?? faker.string.uuid();
  const _operationOutcome = operationOutcome ?? makeOperationOutcome();

  return {
    id: _id,
    timestamp: _timestamp,
    responseTimestamp: _responseTimestamp,
    cxId: _cxId,
    externalGatewayPatient: _externalGatewayPatient,
    patientId: _patientId,
    operationOutcome: _operationOutcome,
  };
}

export function makeBaseErrorResponse({
  id,
  timestamp,
  responseTimestamp,
  cxId,
  externalGatewayPatient,
  patientId,
  operationOutcome,
}: Partial<BaseErrorResponse> = {}): BaseErrorResponse {
  const _id = id ?? faker.string.uuid();
  const _timestamp = timestamp ?? faker.date.recent().toISOString();
  const _responseTimestamp = responseTimestamp ?? faker.date.recent().toISOString();
  const _cxId = cxId ?? faker.string.uuid();
  const _externalGatewayPatient = externalGatewayPatient ?? makeExternalGatewayPatient();
  const _patientId = patientId ?? faker.string.uuid();
  const _operationOutcome = operationOutcome ?? makeOperationOutcome();

  return {
    id: _id,
    timestamp: _timestamp,
    responseTimestamp: _responseTimestamp,
    cxId: _cxId,
    externalGatewayPatient: _externalGatewayPatient,
    patientId: _patientId,
    operationOutcome: _operationOutcome,
  };
}

export function makeIdSystem({ id, system }: Partial<IdSystem> = {}): IdSystem {
  const _id = id ?? faker.string.uuid();
  const _system = system ?? faker.lorem.word();

  return {
    id: _id,
    system: _system,
  };
}

export function makeOutboundDocumentQueryResp({
  id,
  timestamp,
  responseTimestamp,
  cxId,
  externalGatewayPatient,
  patientId,
  operationOutcome,
  documentReference,
  gateway,
}: Partial<OutboundDocumentQueryResp> = {}): OutboundDocumentQueryResp {
  const _id = id ?? faker.string.uuid();
  const _timestamp = timestamp ?? faker.date.recent().toISOString();
  const _responseTimestamp = responseTimestamp ?? faker.date.recent().toISOString();
  const _cxId = cxId ?? faker.string.uuid();
  const _externalGatewayPatient = externalGatewayPatient ?? makeIdSystem();
  const _patientId = patientId ?? faker.string.uuid();
  const _operationOutcome = operationOutcome ?? makeOperationOutcome();
  const _documentReference = documentReference ?? [makeDocumentReferenceWithMetriporId()];
  const _gateway = gateway ?? makeXcaGateway();

  return {
    id: _id,
    timestamp: _timestamp,
    responseTimestamp: _responseTimestamp,
    cxId: _cxId,
    externalGatewayPatient: _externalGatewayPatient,
    patientId: _patientId,
    operationOutcome: _operationOutcome,
    documentReference: _documentReference,
    gateway: _gateway,
  };
}

export function makeSamlAttributes({
  subjectId,
  subjectRole,
  organization,
  organizationId,
  homeCommunityId,
  purposeOfUse,
}: Partial<SamlAttributes> = {}): SamlAttributes {
  const _subjectId = subjectId ?? faker.string.uuid();
  const _subjectRole = subjectRole ?? {
    code: faker.lorem.word(),
    display: faker.lorem.word(),
  };
  const _organization = organization ?? faker.lorem.word();
  const _organizationId = organizationId ?? faker.string.uuid();
  const _homeCommunityId = homeCommunityId ?? faker.string.uuid();
  const _purposeOfUse = purposeOfUse ?? faker.lorem.word();

  return {
    subjectId: _subjectId,
    subjectRole: _subjectRole,
    organization: _organization,
    organizationId: _organizationId,
    homeCommunityId: _homeCommunityId,
    purposeOfUse: _purposeOfUse,
  };
}

export function makeXcaGateway({ homeCommunityId, url }: Partial<XCAGateway> = {}): XCAGateway {
  const _homeCommunityId = homeCommunityId ?? faker.string.uuid();
  const _url = url ?? faker.internet.url();

  return {
    homeCommunityId: _homeCommunityId,
    url: _url,
  };
}

export function makeXcpdGateway({ oid, url, id }: Partial<XCPDGateway> = {}): XCPDGateway {
  const _oid = oid ?? faker.string.uuid();
  const _url = url ?? faker.internet.url();
  const _id = id ?? faker.string.uuid();

  return {
    oid: _oid,
    url: _url,
    id: _id,
  };
}

export function makeExternalGatewayPatient({
  id,
  system,
}: Partial<XCPDPatientId> = {}): XCPDPatientId {
  const _id = id ?? faker.string.uuid();
  const _system = system ?? faker.lorem.word();

  return {
    id: _id,
    system: _system,
  };
}
