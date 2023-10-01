import { SQS } from "aws-sdk";
import { uniqBy } from "lodash";
import BadRequestError from "../../../errors/bad-request";
import {
  attributesToSend,
  getMessageCountFromQueue,
  getMessagesFromQueue,
  sqs,
} from "../../../external/aws/sqs";
import { Config } from "../../../shared/config";
import { uuidv4 } from "../../../shared/uuid-v7";

const dlqUrl = Config.getSidechainFHIRConverterDQLURL();
const regularUrl = Config.getSidechainFHIRConverterQueueURL();

const maxNumberOfMessagesPerQuery = 10;
const systemMaxNumberOfMessages = 100_000;

/**
 * ADMIN LOGIC - not to be used by other endpoints/services.
 *
 * Gets all messages from the Sidechain DLQ, unique, and sends them to the
 * regular queue for re-processing.
 */
export async function redriveSidechainDLQ(maxNumberOfMessages: number): Promise<{
  originalCount: number;
  uniqueCount: number;
}> {
  if (!dlqUrl) throw new BadRequestError("Missing sidechain DLQ URL");
  if (!regularUrl) throw new BadRequestError("Missing sidechain DLQ URL");
  return redriveSQSUnique({
    sourceQueueUrl: dlqUrl,
    destinationQueueUrl: regularUrl,
    maxNumberOfMessages,
    contentComparator: (m: SQS.Message) => (m.Body ? JSON.parse(m.Body).s3FileName : ""),
  });
}

// TODO consider exposing this to a shared library in core, along with Lambda's SQSUtils
async function redriveSQSUnique({
  sourceQueueUrl,
  destinationQueueUrl,
  maxNumberOfMessages,
  contentComparator = defaultComparator,
}: {
  sourceQueueUrl: string;
  destinationQueueUrl: string;
  maxNumberOfMessages: number;
  contentComparator?: ContentComparator;
}): Promise<{
  originalCount: number;
  uniqueCount: number;
}> {
  const convertedMaxNumberOfMessages =
    maxNumberOfMessages < 0 ? systemMaxNumberOfMessages : maxNumberOfMessages;
  const actualMaxNumberOfMessages = Math.min(
    convertedMaxNumberOfMessages,
    systemMaxNumberOfMessages
  );

  const messageCount = await getMessageCountFromQueue(sourceQueueUrl);
  console.log(`>>> Message count: ${messageCount}`);
  const numberOfParallelRequests = Math.floor(messageCount / maxNumberOfMessagesPerQuery);

  console.log(`>>> Getting messages from source queue...`);
  const messages: SQS.Message[] = [];
  await Promise.allSettled(
    [...Array(numberOfParallelRequests).keys()].map(async () => {
      const messagesOfRequest = await getMessagesFromQueue(sourceQueueUrl, {
        maxNumberOfMessagesPerQuery,
        maxNumberOfMessages: actualMaxNumberOfMessages,
        poolUntilEmpty: true,
      });
      messages.push(...messagesOfRequest);
    })
  );

  // console.log(`>>> Messages from source queue:`);
  // messages.forEach(message => {
  //   console.log("... ", message.Body);
  // });

  const uniqueMessages = uniqBy(messages, contentComparator);
  console.log(`>>> Unique messages:`);
  uniqueMessages.forEach(message => {
    console.log("... ", message.Body);
  });

  console.log(`>>> Sending unique messages to destination queue...`);
  await sqs
    .sendMessageBatch({
      QueueUrl: destinationQueueUrl,
      Entries: uniqueMessages.map(m => ({
        Id: m.MessageId ?? uuidv4(),
        MessageBody: m.Body ?? "",
        MessageAttributes: m.MessageAttributes && attributesToSend(m.MessageAttributes),
      })),
    })
    .promise();

  const result = {
    originalCount: messages.length,
    uniqueCount: uniqueMessages.length,
  };
  console.log(`>>> Success! ${JSON.stringify(result)})}`);
  return result;
}

type ContentComparator = (m: SQS.Message) => string;
const defaultComparator: ContentComparator = (m: SQS.Message) => m.Body ?? "";
