import { out } from "@metriport/core/util/log";
import { errorToString } from "@metriport/shared";
import CloudWatch, { MetricData, MetricDatum } from "aws-sdk/clients/cloudwatch";
import { capture } from "./capture";
import { kbToMb, kbToMbString } from "./units";

export type DurationMetric = { duration: number; count?: undefined; timestamp: Date };
export type CountMetric = { duration?: undefined; count: number; timestamp: Date };

export type Metrics = Record<string, DurationMetric | CountMetric>;

/**
 * Utility class for reporting metrics to CloudWatch.
 *
 * Requires either a `metricsNamespace` to be passed to the constructor or
 * passed to the individual functions.
 *
 * @deprecated Use the functions in @metriport/core/external/aws/cloudwatch instead.
 */
export class CloudWatchUtils {
  public readonly _cloudWatch: CloudWatch;

  constructor(
    readonly region: string,
    readonly lambdaName: string,
    readonly metricsNamespace?: string
  ) {
    this._cloudWatch = new CloudWatch({ apiVersion: "2010-08-01", region });
  }

  get cloudWatch(): CloudWatch {
    return this._cloudWatch;
  }

  async reportMetrics(metrics: Metrics, metricsNamespace?: string) {
    try {
      const namespaceToUse = metricsNamespace ?? this.metricsNamespace;
      if (!namespaceToUse) throw new Error(`Missing metricsNamespace`);
      const durationMetric = (name: string, values: DurationMetric): MetricDatum => ({
        MetricName: name,
        Value: values.duration,
        Unit: "Milliseconds",
        Timestamp: values.timestamp,
        Dimensions: [{ Name: "Service", Value: this.lambdaName }],
      });
      const countMetric = (name: string, values: CountMetric) => ({
        MetricName: name,
        Value: values.count,
        Unit: "Count",
        Timestamp: values.timestamp,
        Dimensions: [{ Name: "Service", Value: this.lambdaName }],
      });
      const metricData: MetricData = [];
      for (const [key, value] of Object.entries(metrics)) {
        if (value.duration) {
          metricData.push(durationMetric(key, value));
        } else if (value.count) {
          metricData.push(countMetric(key, value));
        }
      }
      await this._cloudWatch
        .putMetricData({ MetricData: metricData, Namespace: namespaceToUse })
        .promise();
    } catch (err) {
      const msg = "Failed to report metrics";
      const errorAsStr = errorToString(err);
      out("reportMetrics").log(`${msg}, `, metrics, errorAsStr);
      capture.message(msg, {
        extra: { metrics, error: errorAsStr, context: "lambdas.reportMetrics" },
        level: "warning",
      });
      // intentionally not rethrowing, don't want to fail the lambda
    }
  }

  /**
   * Report memory usage to CloudWatch, under our custom namespace.
   *
   * NOTE: metricName should be defined, unless we're capturing the memory usage a single time
   * per execution (e.g., lambda invocation).
   *
   * @param metricsNamespace - The namespace to use for the metrics.
   * @param metricName - The name of the metric (e.g., "preSetup", "postSetup").
   */
  async reportMemoryUsage({
    metricsNamespace,
    metricName,
  }: {
    metricsNamespace?: string;
    metricName?: string;
  } = {}) {
    const mem = process.memoryUsage();
    logMemoryUsage(mem);
    try {
      const namespaceToUse = metricsNamespace ?? this.metricsNamespace;
      if (!namespaceToUse) throw new Error(`Missing metricsNamespace`);
      await this._cloudWatch
        .putMetricData({
          MetricData: [
            {
              MetricName: metricName ?? "Memory total",
              Value: kbToMb(mem.rss),
              Unit: "Megabytes",
              Timestamp: new Date(),
              Dimensions: [{ Name: "Service", Value: this.lambdaName }],
            },
          ],
          Namespace: namespaceToUse,
        })
        .promise();
    } catch (err) {
      const msg = "Failed to report memory usage";
      const errorAsStr = errorToString(err);
      out("reportMemoryUsage").log(`${msg}, `, mem, errorAsStr);
      capture.message(msg, {
        extra: { mem, error: errorAsStr, context: "lambdas.reportMemoryUsage" },
        level: "warning",
      });
      // intentionally not rethrowing, don't want to fail the lambda
    }
  }
}

export function logMemoryUsage(mem = process.memoryUsage()) {
  out("logMemoryUsage").log(
    `[MEM] rss:  ${kbToMbString(mem.rss)}, ` +
      `heap: ${kbToMbString(mem.heapUsed)}/${kbToMbString(mem.heapTotal)}, ` +
      `external: ${kbToMbString(mem.external)}, ` +
      `arrayBuffers: ${kbToMbString(mem.arrayBuffers)}, `
  );
}
