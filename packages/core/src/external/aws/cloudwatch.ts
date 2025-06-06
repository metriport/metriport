import { errorToString } from "@metriport/shared";
import CloudWatch, { MetricData, MetricDatum } from "aws-sdk/clients/cloudwatch";
import { capture } from "../../util/notifications";
import { kbToMb, kbToMbString } from "../../util/units";

export type DurationMetric = { duration: number; count?: undefined; timestamp: Date };
export type CountMetric = { duration?: undefined; count: number; timestamp: Date };

export type Metrics = Record<string, DurationMetric | CountMetric>;

export const DEFAULT_METRICS_NAMESPACE = "Metriport";

/**
 * Utility class for reporting metrics to CloudWatch.
 *
 * Requires either a `metricsNamespace` to be passed to the constructor or
 * passed to the individual functions.
 *
 * Example:
 * ```
 * const cloudWatchUtils = new CloudWatchUtils(region, context);
 * await cloudWatchUtils.reportMetrics({
 *   myMetric: { duration: 100, timestamp: new Date() },
 * });
 * ```
 *
 * You can also group many metrics in one call:
 * ```
 * const cloudWatchUtils = new CloudWatchUtils(region, context);
 * const metrics: Metrics = {};
 * metrics.myMetric = { duration: 100, timestamp: new Date() };
 * ...
 * metrics.myOtherMetric = { duration: 200, timestamp: new Date() };
 * ...
 * await cloudWatchUtils.reportMetrics(metrics);
 * ```
 */
export class CloudWatchUtils {
  public readonly _cloudWatch: CloudWatch;

  /**
   * @param region - The AWS region to use for the CloudWatch client.
   * @param context - The context to use for the metrics, like use case, product feature,
   *                  lambda name, etc.
   * @param metricsNamespace - The (CloudWatch) namespace to use for the metrics. Optional,
   *                           defaults to `Metriport`.
   */
  constructor(
    readonly region: string,
    readonly context: string,
    readonly metricsNamespace: string = DEFAULT_METRICS_NAMESPACE
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
      Dimensions: [{ Name: "Service", Value: this.context }],
    });
    const countMetric = (name: string, values: CountMetric) => ({
      MetricName: name,
      Value: values.count,
      Unit: "Count",
      Timestamp: values.timestamp,
      Dimensions: [{ Name: "Service", Value: this.context }],
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
    } catch (error) {
      const msg = "Failed to report metrics";
      console.log(`${msg}, ${JSON.stringify(metrics)} - ${errorToString(error)}`);
      capture.error(msg, { extra: { metrics, error } });
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
    const namespaceToUse = metricsNamespace ?? this.metricsNamespace;
    if (!namespaceToUse) throw new Error(`Missing metricsNamespace`);
    const mem = process.memoryUsage();
    logMemoryUsage(mem);
    try {
      await this._cloudWatch
        .putMetricData({
          MetricData: [
            {
              MetricName: metricName ?? "Memory total",
              Value: kbToMb(mem.rss),
              Unit: "Megabytes",
              Timestamp: new Date(),
              Dimensions: [{ Name: "Service", Value: this.context }],
            },
          ],
          Namespace: namespaceToUse,
        })
        .promise();
    } catch (error) {
      const msg = "Failed to report memory usage";
      console.log(`${msg} - ${errorToString(error)}`);
      capture.error(msg, { extra: { error } });
      // intentionally not rethrowing, don't want to fail the lambda
    }
  }
}

export function logMemoryUsage(mem = process.memoryUsage()) {
  console.log(
    `[MEM] rss:  ${kbToMbString(mem.rss)}, ` +
      `heap: ${kbToMbString(mem.heapUsed)}/${kbToMbString(mem.heapTotal)}, ` +
      `external: ${kbToMbString(mem.external)}, ` +
      `arrayBuffers: ${kbToMbString(mem.arrayBuffers)}, `
  );
}

/**
 * Executes a function and stores the time it took to execute it in the metrics object.
 * Optionally logs the time it took to execute it if the log parameter is provided.
 *
 * @param fn - The function to execute.
 * @param name - The name of the function to log. Also used to populate metrics if present.
 * @param metrics - The metrics to populate.
 * @param log - The logger to use. Optional, doesn't log if not provided.
 * @returns The result of the function.
 */
export async function withMetrics<T>(
  fn: () => Promise<T>,
  name: string,
  metrics: Metrics,
  log?: typeof console.log
) {
  const startedAt = Date.now();
  const result = await fn();
  const elapsedTime = Date.now() - startedAt;
  metrics[name] = { duration: elapsedTime, timestamp: new Date() };
  if (log) log(`Done ${name} in ${elapsedTime} ms`);
  return result;
}
