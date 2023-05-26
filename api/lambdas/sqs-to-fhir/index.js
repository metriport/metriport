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
const MAX_TIMEOUT_RETRIES = getEnvOrFail("MAX_TIMEOUT_RETRIES");
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

export const handler = async function (event) {
  try {
    // Process messages from SQS
    const records = event.Records; // SQSRecord[]
    if (!records || records.length < 1) {
      console.log(`No records, discarding this event: ${JSON.stringify(event)}`);
      return;
    }
    if (records.length > 1) {
      Sentry.captureMessage("Got more than one message from SQS", {
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
        const payloadRaw = await downloadFileContents(s3BucketName, s3FileName);
        const payload = JSON.parse(payloadRaw).fhirResource;

        log(`Sending payload to FHIRServer, cxId ${cxId}...`);
        const fhirApi = new MedplumClient({
          fetch,
          baseUrl: fhirServerUrl,
          fhirUrlPath: `fhir/${cxId}`,
        });
        await fhirApi.executeBatch(payload);
        //
      } catch (err) {
        // If it timed-out let's just reenqueue for future processing - NOTE: the destination MUST be idempotent!
        const count = message.attributes?.ApproximateReceiveCount;
        if (err.code === "ETIMEDOUT" && count <= MAX_TIMEOUT_RETRIES) {
          console.log(`Timed out, reenqueue (${count} of ${MAX_TIMEOUT_RETRIES}): `, message);
          Sentry.captureMessage("Sending to FHIR server timed out", {
            extra: { message, context: lambdaName, retryCount: count },
          });
          await reEnqueue(message);
        } else {
          console.log(`Error processing message: `, message, err);
          Sentry.captureException(err, {
            extra: { message, context: lambdaName, retryCount: count },
          });
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
    Sentry.captureException(err, {
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
  };
  try {
    await sqs.sendMessage(sendParams).promise();
  } catch (err) {
    console.log(`Failed to re-enqueue message: `, message, err);
    Sentry.captureException(err, {
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
    Sentry.captureException(err, {
      extra: { message, deleteParams, context: "dequeue" },
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

function attributesToSend(inboundMessageAttribs) {
  let res = {};
  for (const [key, value] of Object.entries(inboundMessageAttribs)) {
    res = {
      ...res,
      ...singleAttributeToSend(key, value),
    };
  }
  return res;
}

function singleAttributeToSend(name, value) {
  return {
    [name]: {
      DataType: value.dataType,
      StringValue: value.stringValue,
    },
  };
}

function _log(prefix) {
  return (msg, ...optionalParams) =>
    optionalParams
      ? console.log(`[${prefix}] ${msg}`, ...optionalParams)
      : console.log(`[${prefix}] ${msg}`);
}
