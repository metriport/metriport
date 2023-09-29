import AWS from "aws-sdk";
import { Config } from "../../shared/config";
import { capture } from "../../shared/notifications";

/**
 * @deprecated Move this to @metriport/core/aws
 */
export const METRICS_NAMESPACE = "Metriport";

const cw = new AWS.CloudWatch({ apiVersion: "2010-08-01", region: Config.getAWSRegion() });

/**
 * @deprecated Move this to @metriport/core/aws
 */
export type Metric = {
  name: string;
  unit: "Milliseconds";
  value: number | string;
  timestamp?: Date;
  additionalDimension?: string;
};

/**
 * @deprecated Move this to @metriport/core/aws
 */
export function reportMetric(metric: Metric) {
  try {
    const metricBase = {
      MetricName: metric.name,
      Timestamp: metric.timestamp ?? new Date(),
      Unit: metric.unit,
      Value: typeof metric.value === "string" ? parseFloat(metric.value) : metric.value,
    };
    return cw
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
