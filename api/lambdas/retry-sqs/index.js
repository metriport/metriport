import * as Sentry from "@sentry/node";
import * as AWS from "aws-sdk";
import { nanoid } from "nanoid";

// Get ONE message from the source queue and send to the destination one
const numberOfMessagesPerExecution = 1; // up to 10

export function getEnv(name) {
  return process.env[name];
}
export function getEnvOrFail(name) {
  const value = getEnv(name);
  if (!value || value.trim().length < 1) throw new Error(`Missing env var ${name}`);
  return value;
}

const lambdaName = getEnv("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
const sourceQueue = getEnvOrFail("SOURCE_QUEUE");
const destinationQueue = getEnvOrFail("DESTINATION_QUEUE");

const sqs = new AWS.SQS({ region });

export const handler = async function (event) {
  // Set it up
  console.log(`Running w/ SOURCE_QUEUE = ${sourceQueue}, DESTINATION_QUEUE = ${destinationQueue}`);

  try {
    const requestParams = {
      QueueUrl: sourceQueue,
      AttributeNames: ["All"],
      MessageAttributeNames: ["All"],
      MaxNumberOfMessages: numberOfMessagesPerExecution,
      VisibilityTimeout: 5,
      WaitTimeSeconds: 5,
    };
    console.log(`Requesting message w/ params: ${JSON.stringify(requestParams)}...`);
    const receiveResult = await sqs.receiveMessage(requestParams).promise();
    if (!receiveResult.Messages || receiveResult.Messages.length <= 0) {
      console.log(`Didn't get any message from queue: ${sourceQueue}`);
      return;
    }
    console.log(`Received ${receiveResult.Messages} messages`);

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
      const messageAttributes = {};
      if (message.MessageAttributes) {
        const attributes = message.MessageAttributes;
        Object.keys(attributes).forEach(prop => {
          const attrib = attributes[prop];
          messageAttributes[prop] = {
            DataType: attrib.DataType,
            StringValue: attrib.StringValue,
          };
        });
      }
      const sendParams = {
        MessageBody: message.Body,
        MessageDeduplicationId: nanoid(),
        MessageGroupId: message.Attributes.MessageGroupId,
        QueueUrl: destinationQueue,
        MessageAttributes: messageAttributes,
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
    Sentry.captureException(err, {
      extra: { event, context: lambdaName },
    });
    throw err;
  }
};
