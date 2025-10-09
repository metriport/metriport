import AWS from "aws-sdk";
import { Config } from "../../util/config";
import { capture } from "../../util/notifications";

export const METRICS_NAMESPACE = "Metriport";
const MAX_DIMENSIONS = 3;

const cw = new AWS.CloudWatch({ apiVersion: "2010-08-01", region: Config.getAWSRegion() });

export type Metric = {
  name: string;
  unit: "Milliseconds" | "Count";
  value: number | string;
  timestamp?: Date;
  additionalDimension?: string;
};

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
    console.error(`Error reporting metric ${JSON.stringify(metric)}: ${err}`);
    capture.error(err, { extra: { metric, context: "reportMetric" } });
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
 * @param service - The service that is reporting the metric.
 * @param metrics - The metrics to report.
 * @param dimensionLimitOverride - Set to true to override the 3-metric safety limit.
 */
export async function reportAdvancedMetric({
  service,
  metrics,
  dimensionLimitOverride = false,
}: {
  service: string;
  metrics: AdvancedMetric[];
  dimensionLimitOverride?: boolean;
}) {
  if (!dimensionLimitOverride && metrics.length > MAX_DIMENSIONS) {
    throw new Error(
      `Attempting to report a metric with ${metrics.length} dimensions. This will likely blow up AWS costs. ` +
        `If you've done a cost estimate, and still want to proceed, set dimensionLimitOverride to true.`
    );
  }

  try {
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
    console.error(`Error reporting metrics ${JSON.stringify(metrics)}: ${err}`);
    capture.error(err, { extra: { metrics, context: "reportChartableMetric" } });
  }
}
