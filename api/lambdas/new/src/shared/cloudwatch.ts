import * as AWS from "aws-sdk";
import CloudWatch, { MetricData, MetricDatum } from "aws-sdk/clients/cloudwatch";
import { capture } from "./capture";
import { kbToMb, kbToMbString } from "./units";

export type DurationMetric = { duration: number; timestamp: Date };

export type Metrics = {
  cxId: string;
  patientId: string;
  download?: DurationMetric;
  conversion?: DurationMetric;
  postProcess?: DurationMetric;
  upload?: DurationMetric;
  notify?: DurationMetric;
};

export class CloudWatchUtils {
  public readonly _cloudWatch: CloudWatch;

  constructor(
    readonly region: string,
    readonly lambdaName: string,
    readonly metricsNamespace?: string
  ) {
    this._cloudWatch = new AWS.CloudWatch({ apiVersion: "2010-08-01", region });
  }

  get cloudWatch(): CloudWatch {
    return this._cloudWatch;
  }

  async reportMetrics(metrics: Metrics, metricsNamespace?: string) {
    const namespaceToUse = metricsNamespace ?? this.metricsNamespace;
    if (!namespaceToUse) throw new Error(`Missing metricsNamespace`);
    const { download, conversion, postProcess } = metrics;
    const metric = (name: string, values: DurationMetric): MetricDatum => ({
      MetricName: name,
      Value: values.duration,
      Unit: "Milliseconds",
      Timestamp: values.timestamp,
      Dimensions: [{ Name: "Service", Value: this.lambdaName }],
    });
    try {
      const metricData: MetricData = [];
      download && metric("Download", download);
      conversion && metric("Conversion", conversion);
      postProcess && metric("PostProcess", postProcess);
      await this._cloudWatch
        .putMetricData({ MetricData: metricData, Namespace: namespaceToUse })
        .promise();
    } catch (err) {
      console.log(`Failed to report metrics, `, metrics, err);
      capture.error(err, { extra: { metrics } });
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
    }
  }
}
