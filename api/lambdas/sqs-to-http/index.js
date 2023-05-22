import * as AWS from "aws-sdk";
import axios from "axios";

export function getEnv(name) {
  return process.env[name];
}
export function getEnvOrFail(name) {
  const value = getEnv(name);
  if (!value || value.trim().length < 1) throw new Error(`Missing env var ${name}`);
  return value;
}

const region = getEnvOrFail("AWS_REGION");
const dlqURL = getEnvOrFail("DLQ_URL");

const sqs = new AWS.SQS({ region });
const api = axios.create();

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
        console.log(`[${i}] Message attributes: ${JSON.stringify(attrib)}`);
        const cxId = attrib?.cxId?.stringValue;
        const serverUrl = attrib?.serverUrl?.stringValue;
        console.log(`[${i}] cxId: ${cxId}, serverUrl: ${serverUrl}`);

        console.log(`[${i}] Sending payload: ${JSON.stringify(payload)}`);
        const res = await api.post(serverUrl, payload, { params: { cxId } });
        console.log(`[${i}] Success: status: ${res.status}, body: ${JSON.stringify(res.body)}`);

        // TODO 706 implement partial batch response:
        // try {
        //   const deleteParams = {
        //     QueueUrl: sourceQueue, // TODO pass this as an env var
        //     ReceiptHandle: message.receiptHandle,
        //   };
        //   const deleteResult = await sqs.deleteMessage(deleteParams).promise();
        //   console.log(`Message removed from queue, result: ${JSON.stringify(deleteResult)}`);
        // } catch (err) {
        //   // TODO Add Sentry reporting code
        //   console.log(`Failed to remove message from queue: `, err);
        // }
      } catch (err) {
        // TODO Add Sentry reporting code
        // TODO Add Sentry reporting code
        // TODO Add Sentry reporting code
        // TODO Add Sentry reporting code
        // TODO Add Sentry reporting code
        console.log(`Error processing message: `, message, err);
        // throw err;
        await sendToDLQ(message);
      }
    }

    console.log(`Done`);
  } catch (err) {
    // TODO Add Sentry reporting code
    // TODO Add Sentry reporting code
    // TODO Add Sentry reporting code
    // TODO Add Sentry reporting code
    // TODO Add Sentry reporting code
    console.log(`Error processing event: `, event, err);
    throw err;
  }
};

async function sendToDLQ(message) {
  const sendParams = {
    MessageBody: message.body,
    MessageDeduplicationId: message.attributes.MessageDeduplicationId,
    MessageGroupId: message.attributes.MessageGroupId,
    QueueUrl: dlqURL,
    MessageAttributes: message.messageAttributes,
  };
  console.log(`[DLQ] Sending message w/ params: ${JSON.stringify(sendParams)}...`);
  const sendResult = await sqs.sendMessage(sendParams).promise();
  console.log(`[DLQ] Message sent, receipt: ${sendResult.MessageId}`);
}
