import { MedplumClient } from "@medplum/core";
import * as Sentry from "@sentry/node";
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
const envType = getEnvOrFail("ENV_TYPE");
const sentryDsn = getEnv("SENTRY_DSN");
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

const sqs = new AWS.SQS({ region });
const s3Client = new AWS.S3({ signatureVersion: "v4", region });

/* Example of a single message/record in event's `Records` array:
{
    "messageId": "7f13f086-664b-49f8-b4dc-debcc47c193a",
    "receiptHandle": "AQEBXyzdOCj9Bo6XjSjuQGeEwyjiUBBFa4TRv6/fU2xWdH5RmU3iAoUeYPyu2SgjyjZ6631dIdbODETcUxZn1gECAg3oLMBZc6SFiOgyzTtBG8/wgrTkDwjtS5wKFB/zD10T/EFRllCGmNXkfN2cppdXtBO+ZIF+pdPw5YGL3EZDCyj5sh2qm26gVdEZ5FPNLqpgPdPb0lRUhCaDHVtpzzXDyPYf+cM+xwGg6ydmRY7gWSD1u1oqPGUEZb/VZPGwPE7X45MS9p5NfyXnSRDRJFvIUkeWZyOlVdRwP7ICUJiWDy8=",
    "body": "{\"type\":\"reprocess\",\"fruit\":\"apple\"}",
    "attributes": {
        "ApproximateReceiveCount": "1",
        "AWSTraceHeader": "Root=1-646a7c8c-3c5f0ea61b9a8e633bfad33c;Parent=78bb05ac3530ad87;Sampled=0;Lineage=e4161027:0",
        "SentTimestamp": "1684700300546",
        "SequenceNumber": "18878027350649327616",
        "MessageGroupId": "test-first",
        "SenderId": "AROAWX27OVJFOXNNHQRAU:FHIRConverter_Retry_Lambda",
        "MessageDeduplicationId": "9cxBDxgnpO3ttGoljnRW2",
        "ApproximateFirstReceiveTimestamp": "1684700300546"
    },
    "messageAttributes": {},
    "md5OfBody": "5c4e4cc132cd052442ef41835213c740",
    "eventSource": "aws:sqs",
    "eventSourceARN": "arn:aws:sqs:us-east-2:463519787594:FHIRConverterQueue.fifo",
    "awsRegion": "us-east-2"
}
*/

export const handler = async function (event) {
  try {
    // Process messages from SQS
    const records = event.Records; // SQSRecord[]
    if (!records) {
      console.log(`No records, discarding this event: ${JSON.stringify(event)}`);
      return;
    }
    console.log(`Processing ${records.length} records...`);
    for (const [i, message] of records.entries()) {
      // Process one record from the SQS message
      try {
        if (!message.messageAttributes) throw new Error(`Missing message attributes`);
        if (!message.body) throw new Error(`Missing message body`);

        const attrib = message.messageAttributes;
        const cxId = attrib.cxId?.stringValue;
        if (!cxId) throw new Error(`Missing cxId`);
        const log = _log(`${i} - cxId ${cxId}`);

        const bodyAsJson = JSON.parse(message.body);
        const s3BucketName = bodyAsJson.s3BucketName;
        const s3FileName = bodyAsJson.s3FileName;
        if (!s3BucketName) throw new Error(`Missing s3BucketName`);
        if (!s3FileName) throw new Error(`Missing s3FileName`);

        log(`Getting contents from bucket ${s3BucketName}, key ${s3FileName}`);
        const payload = await downloadFileContents(s3BucketName, s3FileName);

        log(`Sending payload to FHIRServer, cxId ${cxId}...`);
        const fhirApi = new MedplumClient({
          fetch,
          baseUrl: fhirServerUrl,
          fhirUrlPath: `fhir/${cxId}`,
        });
        await fhirApi.executeBatch(payload);

        // To support partial batch response we need to delete the messages that were successfully processed
        // so these are not re-queued in case of failure
        await dequeue(message, log);
        //
      } catch (err) {
        console.log(`Removing message from queue due to error: ${err}`, message);
        await dequeue(message, console.log);
        // If it timed-out let's just reenqueue for future processing - NOTE: the destination MUST be idempotent!
        if (err.code === "ETIMEDOUT") {
          await reEnqueue(message);
        } else {
          console.log(`Error processing message: ${err} `, message);
          Sentry.captureException(err, { extra: { message, context: lambdaName } });
          // Send to DLQ right away otherwise we'll have to wait for message visibility timeout to expire before
          // we can process the next message, when the queue is configured as FIFO.
          await sendToDLQ(message);
        }
      }
    }
    console.log(`Done`);
  } catch (err) {
    console.log(`Error processing event: `, event, err);
    Sentry.captureException(err, {
      extra: { event, context: lambdaName, additional: "outer catch" },
    });
    throw err;
  }
};

async function downloadFileContents(s3BucketName, s3FileName) {
  const stream = s3Client.getObject({ Bucket: s3BucketName, Key: s3FileName }).createReadStream();
  return streamToString(stream);
}

async function dequeue(message, log) {
  const deleteParams = {
    QueueUrl: sourceQueueURL,
    ReceiptHandle: message.receiptHandle,
  };
  try {
    await sqs.deleteMessage(deleteParams).promise();
  } catch (err) {
    log(`Failed to remove message from queue: `, err);
    Sentry.captureException(err, {
      extra: { message, deleteParams, context: "dequeue" },
    });
  }
}

async function reEnqueue(message) {
  const sendParams = {
    MessageBody: message.body,
    // FIFO only
    // 706 MessageDeduplicationId: message.attributes.MessageDeduplicationId,
    // 706 MessageGroupId: message.attributes.MessageGroupId,
    QueueUrl: sourceQueueURL,
    MessageAttributes: message.messageAttributes,
  };
  try {
    // 706 console.log(`Re-enqueue message w/ dedup ID: ${sendParams.MessageDeduplicationId}...`);
    console.log(`Re-enqueue message: ${JSON.stringify(sendParams)}`);
    await sqs.sendMessage(sendParams).promise();
  } catch (err) {
    console.log(`Failed to send message to queue: `, err);
    Sentry.captureException(err, {
      extra: { message, sendParams, context: "reEnqueue" },
    });
  }
}

async function sendToDLQ(message) {
  const sendParams = {
    MessageBody: message.body,
    // FIFO only
    // 706 MessageDeduplicationId: message.attributes.MessageDeduplicationId,
    // 706 MessageGroupId: message.attributes.MessageGroupId,
    QueueUrl: dlqURL,
    MessageAttributes: message.messageAttributes,
  };
  try {
    // 706 console.log(`Sending message to DLQ w/ dedup ID: ${sendParams.MessageDeduplicationId}...`);
    console.log(`Sending message to DLQ: ${JSON.stringify(sendParams)}`);
    await sqs.sendMessage(sendParams).promise();
  } catch (err) {
    console.log(`Failed to send message to queue: `, err);
    Sentry.captureException(err, {
      extra: { message, sendParams, context: "sendToDLQ" },
    });
  }
}

async function streamToString(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on("data", chunk => chunks.push(Buffer.from(chunk)));
    stream.on("error", err => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function _log(prefix) {
  return (msg, ...optionalParams) =>
    optionalParams
      ? console.log(`[${prefix}] ${msg}`, ...optionalParams)
      : console.log(`[${prefix}] ${msg}`);
}
