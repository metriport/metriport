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
    try {
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
      console.log(`Failed to report metrics, `, metrics, err);
      capture.error(err, { extra: { metrics } });
      // intentionally not rethrowing, don't want to fail the lambda
    }
  }

  async reportMemoryUsage(metricsNamespace?: string) {
    const namespaceToUse = metricsNamespace ?? this.metricsNamespace;
    if (!namespaceToUse) throw new Error(`Missing metricsNamespace`);
    const mem = process.memoryUsage();
    console.log(
      `[MEM] rss:  ${kbToMbString(mem.rss)}, ` +
        `heap: ${kbToMbString(mem.heapUsed)}/${kbToMbString(mem.heapTotal)}, ` +
        `external: ${kbToMbString(mem.external)}, ` +
        `arrayBuffers: ${kbToMbString(mem.arrayBuffers)}, `
    );
    try {
      await this._cloudWatch
        .putMetricData({
          MetricData: [
            {
              MetricName: "Memory total",
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
      console.log(`Failed to report memory usage, `, mem, err);
      capture.error(err, { extra: { mem } });
      // intentionally not rethrowing, don't want to fail the lambda
    }
  }
}
