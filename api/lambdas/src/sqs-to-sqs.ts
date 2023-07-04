import * as Sentry from "@sentry/serverless";
import { SQSEvent } from "aws-lambda";
import * as AWS from "aws-sdk";
import { MessageAttributeValue, MessageBodyAttributeMap } from "aws-sdk/clients/sqs";
import { capture } from "./shared/capture";
import { getEnv, getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

const numberOfMessagesPerRetry = 1; // up to 10

// Automatically set by AWS
const lambdaName = getEnv("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const sourceQueue = getEnvOrFail("SOURCE_QUEUE");
const destinationQueue = getEnvOrFail("DESTINATION_QUEUE");

const sqs = new AWS.SQS({ region });

export const handler = Sentry.AWSLambda.wrapHandler(async (event: SQSEvent) => {
  // Set it up
  console.log(
    `Running w/ numberOfMessagesPerRetry = ${numberOfMessagesPerRetry}, ` +
      `SOURCE_QUEUE = ${sourceQueue}, ` +
      `DESTINATION_QUEUE = ${destinationQueue}`
  );

  try {
    const requestParams = {
      QueueUrl: sourceQueue,
      AttributeNames: ["All"],
      MessageAttributeNames: ["All"],
      MaxNumberOfMessages: numberOfMessagesPerRetry,
      VisibilityTimeout: 5,
      WaitTimeSeconds: 5,
    };
    console.log(`Requesting message w/ params: ${JSON.stringify(requestParams)}...`);
    const receiveResult = await sqs.receiveMessage(requestParams).promise();
    if (!receiveResult.Messages || receiveResult.Messages.length <= 0) {
      console.log(`Didn't get any message from queue: ${sourceQueue}`);
      return;
    }
    console.log(`Received ${receiveResult.Messages.length} messages`);

    // ---- Send the message to the queue ----
    for (const message of receiveResult.Messages) {
      if (!message.Body) {
        console.log(`Empty body, skipping: ${JSON.stringify(message)}`);
        return;
      }
      if (!message.ReceiptHandle) {
        console.log(
          `Empty receipt handle (cannot delete it), skipping: ${JSON.stringify(message)}`
        );
        return;
      }
      const sendParams = {
        MessageBody: message.Body,
        QueueUrl: destinationQueue,
        ...(message.MessageAttributes
          ? {
              MessageAttributes: attributesToSend(message.MessageAttributes),
            }
          : {}),
      };
      console.log(`Sending message w/ params: ${JSON.stringify(sendParams)}...`);
      const sendResult = await sqs.sendMessage(sendParams).promise();
      console.log(`Message sent, receipt: ${sendResult.MessageId}`);

      // ---- Remove message from DLQ ----
      const deleteParams = {
        QueueUrl: sourceQueue,
        ReceiptHandle: message.ReceiptHandle,
      };
      const deleteResult = await sqs.deleteMessage(deleteParams).promise();
      console.log(`Message removed from DLQ, result: ${JSON.stringify(deleteResult)}`);
    }
  } catch (err) {
    console.log(`Error retrying message: `, err);
    capture.error(err, {
      extra: { event, context: lambdaName },
    });
    throw err;
  }
});

function attributesToSend(inboundMessageAttribs: MessageBodyAttributeMap) {
  let res = {};
  for (const [key, value] of Object.entries(inboundMessageAttribs)) {
    res = {
      ...res,
      ...singleAttributeToSend(key, value),
    };
  }
  return res;
}

function singleAttributeToSend(name: string, value: MessageAttributeValue) {
  return {
    [name]: {
      DataType: value.DataType,
      StringValue: value.StringValue,
    },
  };
}
