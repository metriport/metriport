import AWS from "aws-sdk";
import { out } from "../../util";
import { Config } from "../../util/config";
import { errorToString } from "@metriport/shared";
import { capture } from "../../util/notifications";

export const METRICS_NAMESPACE = "Metriport";
const MAX_DIMENSIONS = 3;

const cw = new AWS.CloudWatch({ apiVersion: "2010-08-01", region: Config.getAWSRegion() });

export enum Service {
  /** @deprecated Use the logical service name, not where it runs */
  OSS_API = "OSS API",
  HtmlToPdfLambda = "HtmlToPdfLambda",
  CCDAOpenSearchLambda = "CCDAOpenSearchLambda",
  FHIRConverterLambda = "FHIRConverterLambda",
  FhirToMedicalRecordLambda = "FhirToMedicalRecordLambda",
  Hl7NotificationWebhookSender = "Hl7NotificationWebhookSender",
  Hl7NotificationWebhookReceiver = "Hl7NotificationWebhookReceiver",
  Hl7v2RosterGenerator = "Hl7v2RosterGenerator",
  CarequalityDirectory = "CarequalityDirectory",
  Commonwell = "Commonwell",
}

export enum MetricName {
  PATIENT_DISCOVERY_DURATION = "PatientDiscovery.Duration",
  PATIENT_DISCOVERY_ERROR_COUNT = "PatientDiscovery.ErrorCount",
  PATIENT_DISCOVERY_SUCCESS_COUNT = "PatientDiscovery.SuccessCount",
  DOCUMENT_RETRIEVAL_ERROR_COUNT = "DocumentRetrieval.ErrorCount",
  DOCUMENT_RETRIEVAL_SUCCESS_COUNT = "DocumentRetrieval.SuccessCount",
  DOCUMENT_QUERY_DURATION = "DocumentQuery.Duration",
  DOCUMENT_QUERY_ERROR_COUNT = "DocumentQuery.ErrorCount",
  DOCUMENT_QUERY_SUCCESS_COUNT = "DocumentQuery.SuccessCount",
  DOCUMENT_RETRIEVAL_DURATION = "DocumentRetrieval.Duration",
  CQ_DIRECTORY_SEARCH_DURATION = "CQDirectory.SearchDuration",
}

export enum MetricAdditionalDimension {
  COMMONWELL = "CommonWell",
}

export type Metric = {
  name: MetricName;
  unit: "Milliseconds" | "Count";
  value: number | string;
  timestamp?: Date;
  additionalDimension?: string | MetricAdditionalDimension;
};

/**
 * @deprecated Use reportAdvancedMetrics instead
 */
export function reportDurationMetric({
  name,
  queryStart,
  additionalDimension,
}: {
  name: MetricName;
  queryStart: number;
  additionalDimension: MetricAdditionalDimension;
}) {
  const queryDuration = Date.now() - queryStart;
  reportMetric({
    name,
    value: queryDuration,
    unit: "Milliseconds",
    additionalDimension,
  });
}

/**
 * @deprecated Use reportAdvancedMetrics instead
 */
export function reportCountMetric({
  name,
  count,
  additionalDimension,
}: {
  name: MetricName;
  count: number;
  additionalDimension: MetricAdditionalDimension;
}) {
  reportMetric({
    name,
    value: count,
    unit: "Count",
    additionalDimension,
  });
}

export async function reportMetric(metric: Metric) {
  try {
    const metricBase = {
      MetricName: metric.name,
      Timestamp: metric.timestamp ?? new Date(),
      Unit: metric.unit,
      Value: typeof metric.value === "string" ? parseFloat(metric.value) : metric.value,
    };
    await cw
      .putMetricData({
        MetricData: [
          {
            ...metricBase,
            Dimensions: [
              ...(metric.additionalDimension
                ? [
                    {
                      Name: "Additional",
                      Value: metric.additionalDimension,
                    },
                  ]
                : []),
            ],
          },
          { ...metricBase, Dimensions: [{ Name: "Service", Value: "OSS API" }] },
        ],
        Namespace: METRICS_NAMESPACE,
      })
      .promise();
  } catch (err) {
    const msg = "Error reporting metrics";
    const errorAsStr = errorToString(err);
    out("reportMetric").log(`${msg} ${JSON.stringify(metric)}: ${errorAsStr}`);
    capture.message(msg, {
      extra: { metric, context: "core.reportMetric", error: errorAsStr },
      level: "warning",
    });
  }
}

export type AdvancedMetric = {
  name: string;
  unit: "Milliseconds" | "Count";
  value: number | string;
  timestamp?: Date;
  dimensions: {
    [key: string]: string;
  };
};

/**
 * Report a metric with advanced dimensions to CloudWatch.
 *
 * NOTE: This can be VERY expensive if you use high cardinality dimensions,
 * or use a high number of dimensions on a metric.
 *
 * Each metric costs $0.30/mo for every new unique set of dimensions that appear.
 * So a metric with 3 dimensions, each of which contains 10 possible values will cost $300/mo.
 *
 * Beware!!
 *
 * Note: safe to be called asynchronously, without awaiting the result - it
 *
 * @param service - The service that is reporting the metric.
 * @param metrics - The metrics to report.
 * @param dimensionLimitOverride - Set to true to override the 3-metric safety limit.
 */
export async function reportAdvancedMetrics({
  service,
  metrics,
  dimensionLimitOverride = false,
}: {
  service: Service;
  metrics: AdvancedMetric[];
  dimensionLimitOverride?: boolean;
}) {
  try {
    const hasMetricsWithTooManyDimensions = metrics.some(
      metric => Object.keys(metric.dimensions).length > MAX_DIMENSIONS
    );
    if (hasMetricsWithTooManyDimensions && !dimensionLimitOverride) {
      throw new Error(
        `Attempting to report a metric with more than ${MAX_DIMENSIONS} dimensions. This will likely blow up AWS costs. ` +
          `If you've done a cost estimate, and still want to proceed, set dimensionLimitOverride to true.`
      );
    }

    const metricData = metrics.map(metric => {
      const dimensions = metric.dimensions
        ? Object.entries(metric.dimensions).map(([name, value]) => ({
            Name: name,
            Value: value,
          }))
        : [];

      return {
        MetricName: metric.name,
        Timestamp: metric.timestamp ?? new Date(),
        Unit: metric.unit,
        Value: typeof metric.value === "string" ? parseFloat(metric.value) : metric.value,
        Dimensions: [{ Name: "Service", Value: service }, ...dimensions],
      };
    });

    await cw
      .putMetricData({
        MetricData: metricData,
        Namespace: METRICS_NAMESPACE,
      })
      .promise();
  } catch (err) {
    const msg = "Error reporting metrics";
    const errorAsStr = errorToString(err);
    out("reportAdvancedMetrics").log(`${msg} ${JSON.stringify(metrics)}: ${errorAsStr}`);
    capture.message(msg, {
      extra: { metrics, context: "core.reportAdvancedMetrics", error: errorAsStr },
      level: "warning",
    });
  }
}
