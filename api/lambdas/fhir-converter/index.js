import * as Sentry from "@sentry/node";
import * as AWS from "aws-sdk";
import axios from "axios";

const AXIOS_TIMEOUT = 10_000; // milliseconds

export function getEnv(name) {
  return process.env[name];
}
export function getEnvOrFail(name) {
  const value = getEnv(name);
  if (!value || value.trim().length < 1) throw new Error(`Missing env var ${name}`);
  return value;
}

const lambdaName = getEnv("AWS_LAMBDA_FUNCTION_NAME");
const envType = getEnvOrFail("ENV_TYPE");
const region = getEnvOrFail("AWS_REGION");
const sourceQueueURL = getEnvOrFail("QUEUE_URL");
const dlqURL = getEnvOrFail("DLQ_URL");
const apiURL = getEnvOrFail("FHIR_SERVER_URL");

// Keep this as early on the file as possible
Sentry.init({
  dsn: getEnv("SENTRY_DSN"),
  enabled: getEnv("SENTRY_DSN") != null,
  environment: envType,
  // TODO #499 Review this based on the load on our app and Sentry's quotas
  tracesSampleRate: 1.0,
});

const sqs = new AWS.SQS({ region });
const api = axios.create({
  // Only response timeout, no option for connection timeout: https://github.com/axios/axios/issues/4835
  timeout: AXIOS_TIMEOUT,
  transitional: {
    // enables ETIMEDOUT instead of ECONNABORTED for timeouts - https://betterstack.com/community/guides/scaling-nodejs/nodejs-errors/
    clarifyTimeoutError: true,
  },
});

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
        const payload = message.body;
        const attrib = message.messageAttributes;
        // TODO 706 remove this log
        console.log(`[${i}] Message attributes: ${JSON.stringify(attrib)}`);
        const cxId = attrib?.cxId?.stringValue;
        const converterUrl = attrib?.serverUrl?.stringValue;
        // TODO 706 remove this log
        console.log(`[${i}] cxId: ${cxId}, converterUrl: ${converterUrl}`);

        console.log(`[${i}] Calling converter for cxId ${cxId}...`);
        const res = await api.post(converterUrl, payload, { params: { cxId } });
        console.log(`[${i}] Success: status: ${res.status}`);

        // TODO 706 post this on the FHIR queue
        console.log(`[${i}] Sending response for cxId ${cxId}...`);
        const res2 = await api.post(apiURL, res.data, { params: { cxId } });
        console.log(`[${i}] Success: status: ${res2.status}`);

        // To support partial batch response we need to delete the messages that were successfully processed
        // so these are not re-queued in case of failure
        await dequeue(message);
        //
      } catch (err) {
        await dequeue(message);
        // If it timed-out let's just reenqueue for future processing - NOTE: the destination MUST be idempotent!
        if (err.code === "ETIMEDOUT") {
          await reEnqueue(message);
        } else {
          console.log(`Error processing message: `, message, err);
          Sentry.captureException(err, { extra: { event, context: lambdaName } });
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

async function dequeue(message) {
  try {
    const deleteParams = {
      QueueUrl: sourceQueueURL,
      ReceiptHandle: message.receiptHandle,
    };
    const deleteResult = await sqs.deleteMessage(deleteParams).promise();
    console.log(`Message removed from queue, result: ${JSON.stringify(deleteResult)}`);
  } catch (err) {
    // TODO Add Sentry reporting code
    console.log(`Failed to remove message from queue: `, err);
  }
}

async function reEnqueue(message) {
  const sendParams = {
    MessageBody: message.body,
    MessageDeduplicationId: message.attributes.MessageDeduplicationId,
    MessageGroupId: message.attributes.MessageGroupId,
    QueueUrl: sourceQueueURL,
    MessageAttributes: message.messageAttributes,
  };
  console.log(`[Queue] Sending message w/ dedup ID: ${sendParams.MessageDeduplicationId}...`);
  await sqs.sendMessage(sendParams).promise();
}

async function sendToDLQ(message) {
  const sendParams = {
    MessageBody: message.body,
    MessageDeduplicationId: message.attributes.MessageDeduplicationId,
    MessageGroupId: message.attributes.MessageGroupId,
    QueueUrl: dlqURL,
    MessageAttributes: message.messageAttributes,
  };
  console.log(`[DLQ] Sending message w/ dedup ID: ${sendParams.MessageDeduplicationId}...`);
  await sqs.sendMessage(sendParams).promise();
}
