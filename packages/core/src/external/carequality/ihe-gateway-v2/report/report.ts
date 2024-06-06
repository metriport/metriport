import { Pool } from "pg";
import { z } from "zod";
import dayjs from "dayjs";
import {
  OutboundPatientDiscoveryResp,
  XCPDGateway,
  OutboundDocumentQueryResp,
  XCAGateway,
  OutboundDocumentRetrievalResp,
  outboundPatientDiscoveryRespSchema,
  outboundDocumentQueryRespSchema,
  outboundDocumentRetrievalRespSchema,
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

export const patientDiscoveryResultRowSchema = z.object({
  data: outboundPatientDiscoveryRespSchema,
});

export const documentQueryResultRowSchema = z.object({
  data: outboundDocumentQueryRespSchema,
});

export const documentRetrievalResultRowSchema = z.object({
  data: outboundDocumentRetrievalRespSchema,
});

enum Tables {
  PatientDiscoveryResult = "patient_discovery_result",
  DocumentQueryResult = "document_query_result",
  DocumentRetrievalResult = "document_retrieval_result",
}

enum TableColumns {
  request_id = "request_id",
  created_at = "created_at",
}

async function getRandomRequestIds({
  pool,
  tableName,
  since,
  limit,
}: {
  pool: Pool;
  tableName: Tables;
  since: string;
  limit: number;
}): Promise<string[]> {
  const query = `
    SELECT request_id
    FROM ${tableName}
    WHERE created_at >= $1
    ORDER BY created_at DESC
    LIMIT $2;
  `;
  const values = [since, limit];
  const { rows } = await pool.query(query, values);
  return rows.map(row => row.request_id);
}

async function getPatientDiscoveryResultsForRequestId({
  pool,
  requestId,
}: {
  pool: Pool;
  requestId: string;
}): Promise<OutboundPatientDiscoveryResp[]> {
  const query = `
        SELECT *
        FROM ${Tables.PatientDiscoveryResult}
        WHERE ${TableColumns.request_id} = $1;
    `;
  const results = await pool.query(query, [requestId]);
  return results.rows.map(result => {
    const parsed = patientDiscoveryResultRowSchema.parse(result.data);
    return parsed.data;
  });
}

async function getDocumentQueryResultsForRequestId({
  pool,
  requestId,
}: {
  pool: Pool;
  requestId: string;
}): Promise<OutboundDocumentQueryResp[]> {
  const query = `
    SELECT *
    FROM ${Tables.DocumentQueryResult}
    WHERE ${TableColumns.request_id} = $1;
`;
  const results = await pool.query(query, [requestId]);
  return results.rows.map(result => {
    const parsed = documentQueryResultRowSchema.parse(result.data);
    return parsed.data;
  });
}

async function getDocumentRetrievalResultsForRequestId({
  pool,
  requestId,
}: {
  pool: Pool;
  requestId: string;
}): Promise<OutboundDocumentRetrievalResp[]> {
  const query = `
    SELECT *
    FROM ${Tables.DocumentRetrievalResult}
    WHERE ${TableColumns.request_id} = $1;
`;
  const results = await pool.query(query, [requestId]);
  return results.rows.map(result => {
    const parsed = documentRetrievalResultRowSchema.parse(result.data);
    return parsed.data;
  });
}

async function generatePatientDiscoveryReportForRequestId(
  pool: Pool,
  requestId: string
): Promise<Report> {
  const results = await getPatientDiscoveryResultsForRequestId({ pool, requestId });
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
  pool: Pool,
  requestId: string
): Promise<Report> {
  const results = await getDocumentQueryResultsForRequestId({ pool, requestId });
  const total = results.length;

  const successes = results.filter(
    (result: OutboundDocumentQueryResp) => result.documentReference !== undefined
  );

  const failures = results.filter(
    (result: OutboundDocumentQueryResp) => result.documentReference === undefined
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
  pool: Pool,
  requestId: string
): Promise<Report> {
  const results = await getDocumentRetrievalResultsForRequestId({ pool, requestId });
  const total = results.length;

  const successes = results.filter(
    (result: OutboundDocumentRetrievalResp) => result.documentReference !== undefined
  );

  const failures = results.filter(
    (result: OutboundDocumentRetrievalResp) => result.documentReference === undefined
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

export async function generatePatientDiscoveryReport(pool: Pool): Promise<ReportSummary> {
  const twelveHoursAgo = dayjs().subtract(12, "hours").toISOString();
  const requestIds = await getRandomRequestIds({
    pool,
    tableName: Tables.PatientDiscoveryResult,
    since: twelveHoursAgo,
    limit: patientDiscoveryReportRequests,
  });
  const reports = await Promise.all(
    requestIds.map(requestId => generatePatientDiscoveryReportForRequestId(pool, requestId))
  );

  return summarizeReports(reports);
}

export async function generateDocumentQueryReport(pool: Pool): Promise<ReportSummary> {
  const twelveHoursAgo = dayjs().subtract(12, "hours").toISOString();
  const requestIds = await getRandomRequestIds({
    pool,
    tableName: Tables.DocumentQueryResult,
    since: twelveHoursAgo,
    limit: documentQueryReportRequests,
  });
  const reports = await Promise.all(
    requestIds.map(requestId => generateDocumentQueryReportForRequestId(pool, requestId))
  );

  return summarizeReports(reports);
}

export async function generateDocumentRetrievalReport(pool: Pool): Promise<ReportSummary> {
  const twelveHoursAgo = dayjs().subtract(12, "hours").toISOString();
  const requestIds = await getRandomRequestIds({
    pool,
    tableName: Tables.DocumentRetrievalResult,
    since: twelveHoursAgo,
    limit: documentRetrievalReportRequests,
  });
  const reports = await Promise.all(
    requestIds.map(requestId => generateDocumentRetrievalReportForRequestId(pool, requestId))
  );

  return summarizeReports(reports);
}
