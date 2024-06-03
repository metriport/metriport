import { QueryTypes, Sequelize } from "sequelize";
import dayjs from "dayjs";
import {
  OutboundPatientDiscoveryResp,
  XCPDGateway,
  OutboundDocumentQueryResp,
  XCAGateway,
  OutboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";

const patientDiscoveryReportRequests = 10;
const documentQueryReportRequests = 100;
const documentRetrievalReportRequests = 100;

type Report = {
  requestId: string;
  total: number;
  successPercentage: number;
  failurePercentage: number;
  errorOids: {
    oid: string;
    error: string;
  }[];
};

type SimplifiedReport = {
  requestId: string;
  total: number;
  successPercentage: number;
  failurePercentage: number;
};

type ReportSummary = {
  simplifiedReports: SimplifiedReport[];
  averageSuccessPercentage: number;
  averageFailurePercentage: number;
  errorDetailsMap: { [key: string]: { count: number; details: string } };
};

async function getRandomRequestIds({
  sequelize,
  tableName,
  since,
  limit,
}: {
  sequelize: Sequelize;
  tableName: string;
  since: string;
  limit: number;
}): Promise<string[]> {
  const query = `
      SELECT request_id
      FROM ${tableName}
      WHERE created_at >= '${since}'
      ORDER BY created_at DESC
      LIMIT ${limit};
    `;
  const results = await sequelize.query(query, { type: QueryTypes.SELECT });
  // eslint-disable-next-line
  return results.map((row: any) => row.request_id);
}

// execute asynch s
async function getPatientDiscoveryResultsForRequestId({
  sequelize,
  requestId,
}: {
  sequelize: Sequelize;
  requestId: string;
}): Promise<OutboundPatientDiscoveryResp[]> {
  const query = `
        SELECT *
        FROM patient_discovery_result
        WHERE request_id = '${requestId}';
    `;
  const results = await sequelize.query(query, { type: QueryTypes.SELECT });
  return results.map(result => {
    //eslint-disable-next-line
    return (result as any).data as OutboundPatientDiscoveryResp;
  });
}

async function getDocumentQueryResultsForRequestId({
  sequelize,
  requestId,
}: {
  sequelize: Sequelize;
  requestId: string;
}): Promise<OutboundDocumentQueryResp[]> {
  const query = `
    SELECT *
    FROM document_query_result
    WHERE request_id = '${requestId}';
`;
  const results = await sequelize.query(query, { type: QueryTypes.SELECT });
  return results.map(result => {
    //eslint-disable-next-line
    return (result as any).data as OutboundDocumentQueryResp;
  });
}

async function getDocumentRetrievalResultsForRequestId({
  sequelize,
  requestId,
}: {
  sequelize: Sequelize;
  requestId: string;
}): Promise<OutboundDocumentRetrievalResp[]> {
  const query = `
    SELECT *
    FROM document_retrieval_result
    WHERE request_id = '${requestId}';
`;
  const results = await sequelize.query(query, { type: QueryTypes.SELECT });
  return results.map(result => {
    //eslint-disable-next-line
    return (result as any).data as OutboundDocumentRetrievalResp;
  });
}

async function generatePatientDiscoveryReportForRequestId(
  sequelize: Sequelize,
  requestId: string
): Promise<Report> {
  const results = await getPatientDiscoveryResultsForRequestId({ sequelize, requestId });
  const total = results.length;

  const successes = results.filter(
    (result: OutboundPatientDiscoveryResp) =>
      result.patientMatch === true ||
      result.operationOutcome?.issue?.some(issue => issue.code === "not-found")
  );

  const failures = results.filter(
    (result: OutboundPatientDiscoveryResp) =>
      !(
        result.patientMatch === true ||
        result.operationOutcome?.issue?.some(issue => issue.code === "not-found")
      )
  );

  const errorOids = failures.map((error: OutboundPatientDiscoveryResp) => ({
    oid: (error.gateway as XCPDGateway).oid,
    error:
      error.operationOutcome?.issue?.map(issue => JSON.stringify(issue.details)).join(", ") ?? "",
  }));

  return {
    requestId,
    total,
    successPercentage: total > 0 ? (successes.length / total) * 100 : 0,
    failurePercentage: total > 0 ? (failures.length / total) * 100 : 0,
    errorOids,
  };
}

async function generateDocumentQueryReportForRequestId(
  sequelize: Sequelize,
  requestId: string
): Promise<Report> {
  const results = await getDocumentQueryResultsForRequestId({ sequelize, requestId });
  const total = results.length;

  const successes = results.filter(
    (result: OutboundDocumentQueryResp) =>
      (result as OutboundDocumentQueryResp).documentReference !== undefined
  );

  const failures = results.filter(
    (result: OutboundDocumentQueryResp) =>
      (result as OutboundDocumentQueryResp).documentReference === undefined
  );

  const errorOids = failures.map((error: OutboundDocumentQueryResp) => ({
    oid: (error.gateway as XCAGateway).homeCommunityId,
    error:
      error.operationOutcome?.issue?.map(issue => JSON.stringify(issue.details)).join(", ") ?? "",
  }));

  return {
    requestId,
    total,
    successPercentage: total > 0 ? (successes.length / total) * 100 : 0,
    failurePercentage: total > 0 ? (failures.length / total) * 100 : 0,
    errorOids,
  };
}

async function generateDocumentRetrievalReportForRequestId(
  sequelize: Sequelize,
  requestId: string
): Promise<Report> {
  const results = await getDocumentRetrievalResultsForRequestId({ sequelize, requestId });
  const total = results.length;

  const successes = results.filter(
    (result: OutboundDocumentRetrievalResp) =>
      (result as OutboundDocumentRetrievalResp).documentReference !== undefined
  );

  const failures = results.filter(
    (result: OutboundDocumentRetrievalResp) =>
      (result as OutboundDocumentRetrievalResp).documentReference === undefined
  );

  const errorOids = failures.map((error: OutboundDocumentRetrievalResp) => ({
    oid: (error.gateway as XCAGateway).homeCommunityId,
    error:
      error.operationOutcome?.issue?.map(issue => JSON.stringify(issue.details)).join(", ") ?? "",
  }));

  return {
    requestId,
    total,
    successPercentage: total > 0 ? (successes.length / total) * 100 : 0,
    failurePercentage: total > 0 ? (failures.length / total) * 100 : 0,
    errorOids,
  };
}

function summarizeReports(reports: Report[]): ReportSummary {
  const totalReports = reports.length;
  const averageSuccessPercentage =
    reports.reduce((sum, report) => sum + report.successPercentage, 0) / totalReports;
  const averageFailurePercentage =
    reports.reduce((sum, report) => sum + report.failurePercentage, 0) / totalReports;

  const errorDetailsMap: { [key: string]: { count: number; details: string } } = {};
  reports.forEach(report => {
    report.errorOids.forEach(error => {
      const key = `${error.oid}:${error.error}`;
      const errorDetails = errorDetailsMap[key];
      if (errorDetails) {
        errorDetails.count += 1;
      } else {
        errorDetailsMap[key] = { count: 1, details: error.error ?? "" };
      }
    });
  });

  const simplifiedReports: SimplifiedReport[] = reports.map(report => ({
    requestId: report.requestId,
    total: report.total,
    successPercentage: report.successPercentage,
    failurePercentage: report.failurePercentage,
  }));

  return {
    simplifiedReports,
    averageSuccessPercentage,
    averageFailurePercentage,
    errorDetailsMap,
  };
}

export async function generatePatientDiscoveryReport(sequelize: Sequelize): Promise<ReportSummary> {
  const twelveHoursAgo = dayjs().subtract(12, "hours").toISOString();
  const requestIds = await getRandomRequestIds({
    sequelize,
    tableName: "patient_discovery_result",
    since: twelveHoursAgo,
    limit: patientDiscoveryReportRequests,
  });
  const reports = await Promise.all(
    requestIds.map(requestId => generatePatientDiscoveryReportForRequestId(sequelize, requestId))
  );

  return summarizeReports(reports);
}

export async function generateDocumentQueryReport(sequelize: Sequelize): Promise<ReportSummary> {
  const twelveHoursAgo = dayjs().subtract(12, "hours").toISOString();
  const requestIds = await getRandomRequestIds({
    sequelize,
    tableName: "document_query_result",
    since: twelveHoursAgo,
    limit: documentQueryReportRequests,
  });
  const reports = await Promise.all(
    requestIds.map(requestId => generateDocumentQueryReportForRequestId(sequelize, requestId))
  );

  return summarizeReports(reports);
}

export async function generateDocumentRetrievalReport(
  sequelize: Sequelize
): Promise<ReportSummary> {
  const twelveHoursAgo = dayjs().subtract(12, "hours").toISOString();
  const requestIds = await getRandomRequestIds({
    sequelize,
    tableName: "document_retrieval_result",
    since: twelveHoursAgo,
    limit: documentRetrievalReportRequests,
  });
  const reports = await Promise.all(
    requestIds.map(requestId => generateDocumentRetrievalReportForRequestId(sequelize, requestId))
  );

  return summarizeReports(reports);
}
