import {
  OutboundPatientDiscoveryResp,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp,
  isNonErroringOutboundPatientDiscoveryResponse,
  isSuccessfulOutboundPatientDiscoveryResponse,
} from "@metriport/ihe-gateway-sdk";

import {
  httpErrorCode,
  schemaErrorCode,
  registryErrorCode,
  documentNotFoundErrorCode,
} from "@metriport/core/external/carequality/error";

export type GatewayCounts = {
  ehealthexchange: number;
  epic: number;
  allscripts: number;
  ntst: number;
  redox: number;
  surescripts: number;
  athena: number;
  nextgen: number;
  kno2: number;
  medent: number;
  healthgorilla: number;
};

export function getDocumentReferenceContentTypeCounts(
  docRefsContentTypes: string[]
): Record<string, number> {
  const contentTypeCounts = docRefsContentTypes.reduce((acc, curr) => {
    acc[curr] = (acc[curr] || 0) + 1;

    return acc;
  }, {} as Record<string, number>);

  return contentTypeCounts;
}

export function determinePatientDiscoverySuccessGateway(
  response: OutboundPatientDiscoveryResp
): GatewayCounts {
  const gateways = [
    "ehealthexchange",
    "epic",
    "allscripts",
    "ntst",
    "redox",
    "surescripts",
    "athena",
    "nextgen",
    "kno2",
    "medent",
    "healthgorilla",
  ];

  const urlLowerCase = response.gateway.url.toLowerCase();
  const result = gateways.reduce((acc, gateway) => {
    acc[gateway] = urlLowerCase.includes(gateway);
    return acc;
  }, {} as Record<string, boolean>);

  return {
    ehealthexchange: result.ehealthexchange ? 1 : 0,
    epic: result.epic ? 1 : 0,
    allscripts: result.allscripts ? 1 : 0,
    ntst: result.ntst ? 1 : 0,
    redox: result.redox ? 1 : 0,
    surescripts: result.surescripts ? 1 : 0,
    athena: result.athena ? 1 : 0,
    nextgen: result.nextgen ? 1 : 0,
    kno2: result.kno2 ? 1 : 0,
    medent: result.medent ? 1 : 0,
    healthgorilla: result.healthgorilla ? 1 : 0,
  };
}

export function determinePatientDiscoveryFailureType(response: OutboundPatientDiscoveryResp): {
  httpError?: boolean;
  schemaError?: boolean;
  specificError?: boolean;
} {
  if (response.operationOutcome?.issue?.[0]?.code) {
    const issueCode = response.operationOutcome.issue[0].code;
    if (issueCode === httpErrorCode) {
      return { httpError: true };
    } else if (issueCode === schemaErrorCode) {
      return { schemaError: true };
    }
  }
  return { specificError: true };
}

export function getOutboundPatientDiscoverySuccessFailureCount(
  response: OutboundPatientDiscoveryResp[]
): {
  nonErrorCount: number;
  errorCount: number;
  httpErrorCount: number;
  schemaErrorCount: number;
  specificErrorCount: number;
  gatewayCounts: GatewayCounts;
} {
  let nonErrorCount = 0;
  let errorCount = 0;
  let httpErrorCount = 0;
  let schemaErrorCount = 0;
  let specificErrorCount = 0;
  const gatewayCounts = {
    ehealthexchange: 0,
    epic: 0,
    allscripts: 0,
    ntst: 0,
    redox: 0,
    surescripts: 0,
    athena: 0,
    nextgen: 0,
    kno2: 0,
    medent: 0,
    healthgorilla: 0,
  };

  for (const result of response) {
    if (isNonErroringOutboundPatientDiscoveryResponse(result)) {
      nonErrorCount++;
      if (isSuccessfulOutboundPatientDiscoveryResponse(result)) {
        const successGateways = determinePatientDiscoverySuccessGateway(result);
        for (const gateway of Object.keys(successGateways) as (keyof GatewayCounts)[]) {
          if (successGateways[gateway]) {
            gatewayCounts[gateway]++;
          }
        }
      }
    } else {
      const errorType = determinePatientDiscoveryFailureType(result);
      errorCount++;
      if (errorType.httpError) {
        httpErrorCount++;
      } else if (errorType.schemaError) {
        schemaErrorCount++;
      } else {
        specificErrorCount++;
      }
    }
  }

  return {
    nonErrorCount,
    errorCount,
    httpErrorCount,
    schemaErrorCount,
    specificErrorCount,
    gatewayCounts,
  };
}

export function isSuccessfulOutboundDocQueryResponse(obj: OutboundDocumentQueryResp): boolean {
  return (
    "documentReference" in obj ||
    (obj.operationOutcome?.issue?.some(issue => issue.code === "no-documents-found") ?? false)
  );
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
): {
  totalCount: number;
  successCount: number;
  failureCount: number;
  noDocumentFoundCount: number;
  schemaErrorCount: number;
  httpErrorCount: number;
  registryErrorCount: number;
} {
  let successCount = 0;
  let failureCount = 0;
  let totalCount = 0;
  let noDocumentFoundCount = 0;
  let schemaErrorCount = 0;
  let httpErrorCount = 0;
  let registryErrorCount = 0;
  for (const result of response) {
    if (result.documentReference) {
      totalCount += result.documentReference.length;
      successCount += result.documentReference.length;
    }
    if (result.operationOutcome?.issue) {
      totalCount += result.operationOutcome.issue.filter(
        issue => issue.id != undefined && issue.id.length > 0
      ).length;
      failureCount += result.operationOutcome.issue.filter(
        issue => issue.severity === "error"
      ).length;
      noDocumentFoundCount += result.operationOutcome.issue.filter(
        issue => issue.code === documentNotFoundErrorCode
      ).length;
      schemaErrorCount += result.operationOutcome.issue.filter(
        issue => issue.code === schemaErrorCode
      ).length;
      httpErrorCount += result.operationOutcome.issue.filter(
        issue => issue.code === httpErrorCode
      ).length;
      registryErrorCount += result.operationOutcome.issue.filter(
        issue => issue.code === registryErrorCode
      ).length;
    }
  }

  return {
    totalCount,
    successCount,
    failureCount,
    noDocumentFoundCount,
    schemaErrorCount,
    httpErrorCount,
    registryErrorCount,
  };
}
