import {
  OutboundPatientDiscoveryResp,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp,
  isSuccessfulOutboundDocQueryResponse,
  isSuccessfulOutboundDocRetrievalResponse,
  isNonErroringOutboundPatientDiscoveryResponse,
} from "@metriport/ihe-gateway-sdk";

import { httpErrorCode, schemaErrorCode } from "@metriport/core/external/carequality/error";

export function getDocumentReferenceContentTypeCounts(
  docRefsContentTypes: string[]
): Record<string, number> {
  const contentTypeCounts = docRefsContentTypes.reduce((acc, curr) => {
    acc[curr] = (acc[curr] || 0) + 1;

    return acc;
  }, {} as Record<string, number>);

  return contentTypeCounts;
}

export function determinePatientDiscoveryFailureType(response: OutboundPatientDiscoveryResp): {
  httpError: boolean;
  schemaError: boolean;
  specificError: boolean;
} {
  if (response.operationOutcome?.issue?.[0]?.code) {
    const issueCode = response.operationOutcome.issue[0].code;
    if (issueCode === httpErrorCode) {
      return { httpError: true, schemaError: false, specificError: false };
    } else if (issueCode === schemaErrorCode) {
      return { httpError: false, schemaError: true, specificError: false };
    }
  }
  return {
    httpError: false,
    schemaError: false,
    specificError: true,
  };
}

export function getOutboundPatientDiscoverySuccessFailureCount(
  response: OutboundPatientDiscoveryResp[]
): {
  successCount: number;
  failureCount: number;
  httpErrorCount: number;
  schemaErrorCount: number;
  specificErrorCount: number;
} {
  let successCount = 0;
  let failureCount = 0;
  let httpErrorCount = 0;
  let schemaErrorCount = 0;
  let specificErrorCount = 0;
  for (const result of response) {
    if (isNonErroringOutboundPatientDiscoveryResponse(result)) {
      successCount++;
    } else {
      const failureType = determinePatientDiscoveryFailureType(result);
      failureCount++;
      if (failureType.httpError) {
        httpErrorCount++;
      } else if (failureType.schemaError) {
        schemaErrorCount++;
      } else {
        specificErrorCount++;
      }
    }
  }

  return { successCount, failureCount, httpErrorCount, schemaErrorCount, specificErrorCount };
}

export function getOutboundDocQuerySuccessFailureCount(response: OutboundDocumentQueryResp[]): {
  successCount: number;
  failureCount: number;
} {
  let successCount = 0;
  let failureCount = 0;
  for (const result of response) {
    if (isSuccessfulOutboundDocQueryResponse(result)) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  return { successCount, failureCount };
}

export function getOutboundDocRetrievalSuccessFailureCount(
  response: OutboundDocumentRetrievalResp[]
): { successCount: number; failureCount: number } {
  let successCount = 0;
  let failureCount = 0;
  for (const result of response) {
    if (isSuccessfulOutboundDocRetrievalResponse(result)) {
      successCount++;
    } else if (result.operationOutcome?.issue) {
      failureCount++;
    }
  }

  return { successCount, failureCount };
}
