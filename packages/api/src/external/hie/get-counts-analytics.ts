import {
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp,
  isSuccessfulOutboundDocQueryResponse,
  isSuccessfulOutboundDocRetrievalResponse,
} from "@metriport/ihe-gateway-sdk";

export function getDocumentReferenceContentTypeCounts(
  docRefsContentTypes: string[]
): Record<string, number> {
  const contentTypeCounts = docRefsContentTypes.reduce((acc, curr) => {
    acc[curr] = (acc[curr] || 0) + 1;

    return acc;
  }, {} as Record<string, number>);

  return contentTypeCounts;
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
