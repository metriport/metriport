import { MedplumClient } from "@medplum/core";
import * as Sentry from "@sentry/serverless";
import { uuid4 } from "@sentry/utils";
import * as AWS from "aws-sdk";
import fetch from "node-fetch";

export function getEnv(name) {
  return process.env[name];
}
export function getEnvOrFail(name) {
  const value = getEnv(name);
  if (!value || value.trim().length < 1) throw new Error(`Missing env var ${name}`);
  return value;
}

// Automatically set by AWS
const lambdaName = getEnv("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const metricsNamespace = getEnvOrFail("METRICS_NAMESPACE");
const envType = getEnvOrFail("ENV_TYPE");
const apiURL = getEnvOrFail("API_URL");
const sentryDsn = getEnv("SENTRY_DSN");
const maxTimeoutRetries = Number(getEnvOrFail("MAX_TIMEOUT_RETRIES"));
const delayWhenRetryingSeconds = Number(getEnvOrFail("DELAY_WHEN_RETRY_SECONDS"));
const sourceQueueURL = getEnvOrFail("QUEUE_URL");
const dlqURL = getEnvOrFail("DLQ_URL");
const fhirServerUrl = getEnvOrFail("FHIR_SERVER_URL");

// Keep this as early on the file as possible
Sentry.init({
  dsn: sentryDsn,
  enabled: sentryDsn != null,
  environment: envType,
  // TODO #499 Review this based on the load on our app and Sentry's quotas
  tracesSampleRate: 1.0,
});

const maxRetries = 10;
const isSandbox = envType === "sandbox";
const sqs = new AWS.SQS({ region });
const s3Client = new AWS.S3({ signatureVersion: "v4", region });
const cloudWatch = new AWS.CloudWatch({ apiVersion: "2010-08-01", region });
const ossApi = axios.create();
const docProgressURL = `${apiURL}/internal/doc-conversion-status`;
const placeholderReplaceRegex = new RegExp("66666666-6666-6666-6666-666666666666", "g");
const metriportPrefixRegex = new RegExp("Metriport/identifiers/Metriport/", "g");
const sourceUrl = "https://api.metriport.com/cda/to/fhir";

/* Example of a single message/record in event's `Records` array:
{
    "messageId": "2EBA03BC-D6D1-452B-BFC3-B1DD39F32947",
    "receiptHandle": "quite-long-string",
    "body": "{\"s3FileName\":\"nononononono\",\"s3BucketName\":\"nononono\"}",
    "attributes": {
        "ApproximateReceiveCount": "1",
        "AWSTraceHeader": "Root=1-646a7c8c-3c5f0ea61b9a8e633bfad33c;Parent=78bb05ac3530ad87;Sampled=0;Lineage=e4161027:0",
        "SentTimestamp": "1684700300546",
        "SequenceNumber": "18878027350649327616",
        "SenderId": "AROAWX27OVJFOXNNHQRAU:FHIRConverter_Retry_Lambda",
        "ApproximateFirstReceiveTimestamp": "1684700300546"
    },
    "messageAttributes": {
      cxId: {
        stringValue: '7006E0FB-33C8-42F4-B675-A3FD05717446',
        stringListValues: [],
        binaryListValues: [],
        dataType: 'String'
      }
    },
    "md5OfBody": "543u5y34ui53uih543uh5ui4",
    "eventSource": "aws:sqs",
    "eventSourceARN": "arn:aws:sqs:<region>:<acc>>:<queue-name>",
    "awsRegion": "<region>"
}
*/

export const handler = Sentry.AWSLambda.wrapHandler(async event => {
  try {
    // Process messages from SQS
    const records = event.Records; // SQSRecord[]
    if (!records || records.length < 1) {
      console.log(`No records, discarding this event: ${JSON.stringify(event)}`);
      return;
    }
    if (records.length > 1) {
      captureMessage("Got more than one message from SQS", {
        extra: {
          event,
          context: lambdaName,
          additional: `This lambda is supposed to run w/ only 1 message per batch, got ${records.length} (still processing them all)`,
        },
      });
    }
    console.log(`Processing ${records.length} records...`);
    for (const [i, message] of records.entries()) {
      // Process one record from the SQS message
      console.log(`Record ${i}, messageId: ${message.messageId}`);
      try {
        if (!message.messageAttributes) throw new Error(`Missing message attributes`);
        if (!message.body) throw new Error(`Missing message body`);
        const attrib = message.messageAttributes;
        const cxId = attrib.cxId?.stringValue;
        const jobId = attrib.jobId?.stringValue;
        const patientId = attrib.patientId?.stringValue;
        if (!cxId) throw new Error(`Missing cxId`);
        if (!patientId) throw new Error(`Missing patientId`);
        const jobStartedAt = attrib.startedAt?.stringValue;
        const log = _log(`${i}, cxId ${cxId}, patientId ${patientId}, jobId ${jobId}`);

        const bodyAsJson = JSON.parse(message.body);
        const s3BucketName = bodyAsJson.s3BucketName;
        const s3FileName = bodyAsJson.s3FileName;
        if (!s3BucketName) throw new Error(`Missing s3BucketName`);
        if (!s3FileName) throw new Error(`Missing s3FileName`);

        const metrics = { cxId };

        await reportMemoryUsage();
        log(`Getting contents from bucket ${s3BucketName}, key ${s3FileName}`);
        const downloadStart = Date.now();
        const payloadRaw = await downloadFileContents(s3BucketName, s3FileName);
        metrics.download = {
          duration: Date.now() - downloadStart,
          timestamp: new Date().toISOString(),
        };
        await reportMemoryUsage();
        log(`Converting payload to JSON, length ${payloadRaw.length}`);
        let payload;
        if (isSandbox) {
          const idsReplaced = replaceIds(payloadRaw);
          log(`IDs replaced, length: ${idsReplaced.length}`);
          const placeholderUpdated = idsReplaced.replace(placeholderReplaceRegex, patientId);
          payload = JSON.parse(placeholderUpdated);
          log(
            `Payload to FHIR (length ${placeholderUpdated.length}): ${JSON.stringify(
              payload,
              null,
              2
            )}`
          );
        } else {
          payload = JSON.parse(payloadRaw).fhirResource;
        }

        await reportMemoryUsage();
        log(`Sending payload to FHIRServer...`);
        const upsertStart = Date.now();

        const fhirApi = new MedplumClient({
          fetch,
          baseUrl: fhirServerUrl,
          fhirUrlPath: `fhir/${cxId}`,
        });
        let response;
        let count = 0;
        let retry = true;
        while (retry) {
          count++;
          response = await fhirApi.executeBatch(payload);
          const errors = getErrorsFromReponse(response);
          if (errors.length <= 0) break;
          retry = count < maxRetries;
          log(`Got ${errors.length} from FHIR, ${retry ? "" : "NOT "}trying again...`);
        }
        metrics.errorCount = {
          count,
          timestamp: new Date().toISOString(),
        };

        metrics.upsert = {
          duration: Date.now() - upsertStart,
          timestamp: new Date().toISOString(),
        };
        if (jobStartedAt) {
          metrics.job = {
            duration: Date.now() - new Date(jobStartedAt).getTime(),
            timestamp: new Date().toISOString(),
          };
        }

        processResponse(response, event, log);

        await reportMemoryUsage();
        await reportMetrics(metrics);

        await ossApi.post(docProgressURL, null, {
          params: {
            cxId,
            patientId,
            status: "success",
            jobId,
          },
        });
      } catch (err) {
        // If it timed-out let's just reenqueue for future processing - NOTE: the destination MUST be idempotent!
        const count = message.attributes?.ApproximateReceiveCount;
        if (isTimeout(err) && count <= maxTimeoutRetries) {
          console.log(`Timed out, reenqueue (${count} of ${maxTimeoutRetries}): `, message);
          captureMessage("Sending to FHIR server timed out", {
            extra: { message, context: lambdaName, retryCount: count },
          });
          await reEnqueue(message);
          uuid4();
        } else {
          console.log(
            `Error processing message: ${JSON.stringify(message)}; ${JSON.stringify(err)}`
          );
          captureException(err, {
            extra: { message, context: lambdaName, retryCount: count },
          });
          await sendToDLQ(message);

          const cxId = message.messageAttributes?.cxId?.stringValue;
          const patientId = message.messageAttributes?.patientId?.stringValue;
          const jobId = message.messageAttributes?.jobId?.stringValue;

          if (cxId && patientId && jobId) {
            await ossApi.post(docProgressURL, null, {
              params: {
                cxId,
                patientId,
                status: "failed",
                jobId,
              },
            });
          }
        }
      }
    }
    console.log(`Done`);
  } catch (err) {
    console.log(`Error processing event: ${JSON.stringify(event)}; ${JSON.stringify(err)}`);
    captureException(err, {
      extra: { event, context: lambdaName, additional: "outer catch" },
    });
    throw err;
  }
});

function replaceIds(payload) {
  const fhirBundle = JSON.parse(payload);
  const stringsToReplace = [];
  for (const bundleEntry of fhirBundle.entry) {
    // validate resource id
    let idToUse = bundleEntry.resource.id;
    const newId = uuid4();
    bundleEntry.resource.id = newId;
    stringsToReplace.push({ old: idToUse, new: newId });
    // replace meta's source and profile
    bundleEntry.resource.meta = {
      lastUpdated: bundleEntry.resource.meta.lastUpdated ?? new Date().toISOString(),
      source: sourceUrl,
    };
  }
  let fhirBundleStr = JSON.stringify(fhirBundle);
  for (const stringToReplace of stringsToReplace) {
    // doing this is apparently more efficient than just using replace
    const regex = new RegExp(stringToReplace.old, "g");
    fhirBundleStr = fhirBundleStr.replace(regex, stringToReplace.new);
  }

  fhirBundleStr = fhirBundleStr.replace(metriportPrefixRegex, "");

  return fhirBundleStr;
}

// Being more generic with errors, not strictly timeouts
function isTimeout(err) {
  return (
    err.code === "ETIMEDOUT" ||
    err.code === "ERR_BAD_RESPONSE" || // Axios code for 502
    err.code === "ECONNRESET" ||
    err.code === "ESOCKETTIMEDOUT" ||
    err.response?.status === 502 ||
    err.response?.status === 503 ||
    err.response?.status === 504
  );
}

async function downloadFileContents(s3BucketName, s3FileName) {
  const stream = s3Client.getObject({ Bucket: s3BucketName, Key: s3FileName }).createReadStream();
  return streamToString(stream);
}

function getErrorsFromReponse(response) {
  const entries = response.entry ? response.entry : [];
  const errors = entries.filter(
    // returns non-2xx responses AND null/undefined
    e => !e.response?.status?.startsWith("2")
  );
  return errors;
}

function processResponse(response, event, log) {
  const entries = response.entry ? response.entry : [];
  const errors = getErrorsFromReponse(response);
  const countError = errors.length;
  const countSuccess = entries.length - countError;
  log(`Got ${countError} errors and ${countSuccess} successes from FHIR Server`);
  if (errors.length > 0) {
    errors.forEach(e => log(`Error from FHIR Server: ${JSON.stringify(e)}`));
    captureMessage(`Error upserting Bundle on FHIR server`, {
      extra: {
        context: lambdaName,
        additional: "processResponse",
        event,
        countSuccess,
        countError,
      },
      level: "error",
    });
  }
}

async function sendToDLQ(message) {
  await dequeue(message);
  const sendParams = {
    MessageBody: message.body,
    QueueUrl: dlqURL,
    MessageAttributes: attributesToSend(message.messageAttributes),
  };
  try {
    console.log(`Sending message to DLQ: ${JSON.stringify(sendParams)}`);
    await sqs.sendMessage(sendParams).promise();
  } catch (err) {
    console.log(`Failed to send message to queue: `, message, err);
    captureException(err, {
      extra: { message, sendParams, context: "sendToDLQ" },
    });
  }
}

async function reEnqueue(message) {
  await dequeue(message);
  const sendParams = {
    MessageBody: message.body,
    QueueUrl: sourceQueueURL,
    MessageAttributes: attributesToSend(message.messageAttributes),
    DelaySeconds: delayWhenRetryingSeconds, // wait at least that long before retrying
  };
  try {
    await sqs.sendMessage(sendParams).promise();
  } catch (err) {
    console.log(`Failed to re-enqueue message: `, message, err);
    captureException(err, {
      extra: { message, sendParams, context: "reEnqueue" },
    });
  }
}

async function dequeue(message) {
  const deleteParams = {
    QueueUrl: sourceQueueURL,
    ReceiptHandle: message.receiptHandle,
  };
  try {
    await sqs.deleteMessage(deleteParams).promise();
  } catch (err) {
    console.log(`Failed to remove message from queue: `, message, err);
    captureException(err, {
      extra: { message, deleteParams, context: "dequeue" },
    });
  }
}

async function reportMetrics(metrics) {
  const { download, upsert, job, errorCount } = metrics;
  const durationMetric = (name, values, serviceName) => ({
    MetricName: name,
    Value: parseFloat(values.duration),
    Unit: "Milliseconds",
    Timestamp: values.timestamp,
    Dimensions: [{ Name: "Service", Value: serviceName ?? lambdaName }],
  });
  const countMetric = (name, values) => ({
    MetricName: name,
    Value: values.count,
    Unit: "Count",
    Timestamp: values.timestamp,
    Dimensions: [{ Name: "Service", Value: lambdaName }],
  });
  try {
    const MetricData = [durationMetric("Download", download), durationMetric("Upsert", upsert)];
    job && MetricData.push(durationMetric("Job duration", job, "FHIR Conversion Flow"));
    errorCount && MetricData.push(countMetric("FHIR Upsert Errors", errorCount));
    await cloudWatch
      .putMetricData({
        MetricData,
        Namespace: metricsNamespace,
      })
      .promise();
  } catch (err) {
    console.log(`Failed to report metrics, `, metrics, err);
    captureException(err, { extra: { metrics } });
  }
}

async function reportMemoryUsage() {
  var mem = process.memoryUsage();
  console.log(
    `[MEM] rss:  ${kbToMbString(mem.rss)}, ` +
      `heap: ${kbToMbString(mem.heapUsed)}/${kbToMbString(mem.heapTotal)}, ` +
      `external: ${kbToMbString(mem.external)}, ` +
      `arrayBuffers: ${kbToMbString(mem.arrayBuffers)}, `
  );
  try {
    await cloudWatch
      .putMetricData({
        MetricData: [
          {
            MetricName: "Memory total",
            Value: kbToMb(mem.rss),
            Unit: "Megabytes",
            Timestamp: new Date().toISOString(),
            Dimensions: [{ Name: "Service", Value: lambdaName }],
          },
        ],
        Namespace: metricsNamespace,
      })
      .promise();
  } catch (err) {
    console.log(`Failed to report memory usage, `, mem, err);
    captureException(err, { extra: { mem } });
  }
}

function kbToMbString(value) {
  return Number(kbToMb(value)).toFixed(2) + "MB";
}

function kbToMb(value) {
  return value / 1048576;
}

async function streamToString(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on("data", chunk => chunks.push(Buffer.from(chunk)));
    stream.on("error", err => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function attributesToSend(inboundMessageAttribs) {
  let res = {};
  for (const [key, value] of Object.entries(inboundMessageAttribs)) {
    res = {
      ...res,
      ...singleAttributeToSend(key, value.stringValue),
    };
  }
  return res;
}

function singleAttributeToSend(name, value) {
  return {
    [name]: {
      DataType: "String",
      StringValue: value,
    },
  };
}

function _log(prefix) {
  return (msg, ...optionalParams) =>
    optionalParams
      ? console.log(`[${prefix}] ${msg}`, ...optionalParams)
      : console.log(`[${prefix}] ${msg}`);
}

// Keep all capture* functions regardless of usage, so its easier to keep them in sync/the same
// so later we can move them to a lambda layer
function captureException(error, captureContext) {
  const extra = captureContext ? stringifyExtra(captureContext) : {};
  return Sentry.captureException(error, {
    ...captureContext,
    extra,
  });
}
function captureMessage(message, captureContext) {
  const extra = captureContext ? stringifyExtra(captureContext) : {};
  return Sentry.captureMessage(message, {
    ...captureContext,
    extra,
  });
}
function stringifyExtra(captureContext) {
  return Object.entries(captureContext.extra ?? {}).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: JSON.stringify(value, null, 2),
    }),
    {}
  );
}
