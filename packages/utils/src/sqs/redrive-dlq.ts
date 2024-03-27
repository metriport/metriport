/**
 * IMPORTANT: only build this if we want to process messages before redriving them, like doing unique, by date or something else.
 * If we're to just redrive, w can use `sqsmover`: https://github.com/mercury2269/sqsmover
 */
export default {};

// import { SQS } from "aws-sdk";
// import { uniq, uniqBy } from "lodash";
// import { uuidv4 } from "@metriport/core/util/uuid-v7";

// const dlqUrl = Config.getSidechainFHIRConverterDQLURL();
// const regularUrl = Config.getSidechainFHIRConverterQueueURL();

// const maxNumberOfMessagesPerQuery = 10;
// const systemMaxNumberOfMessages = 100_000;

// /**
//  * Gets all messages from a SQS queue, (try to?) unique them, and sends the result to the
//  * regular queue for re-processing.
//  */
// export async function redriveDLQ(maxNumberOfMessages: number): Promise<{
//   originalCount: number;
//   uniqueCount: number;
// }> {
//   if (!dlqUrl) throw new BadRequestError("Missing sidechain DLQ URL");
//   if (!regularUrl) throw new BadRequestError("Missing sidechain DLQ URL");
//   return redriveSQSUnique({
//     sourceQueueUrl: dlqUrl,
//     destinationQueueUrl: regularUrl,
//     maxNumberOfMessages,
//     contentComparator: (m: SQS.Message) => (m.Body ? JSON.parse(m.Body).s3FileName : ""),
//   });
// }

// // TODO consider exposing this to a shared library in core, along with Lambda's SQSUtils
// async function redriveSQSUnique({
//   sourceQueueUrl,
//   destinationQueueUrl,
//   maxNumberOfMessages,
//   contentComparator = defaultComparator,
// }: {
//   sourceQueueUrl: string;
//   destinationQueueUrl: string;
//   maxNumberOfMessages: number;
//   contentComparator?: ContentComparator;
// }): Promise<{
//   originalCount: number;
//   uniqueCount: number;
// }> {
//   const convertedMaxNumberOfMessages =
//     maxNumberOfMessages < 0 ? systemMaxNumberOfMessages : maxNumberOfMessages;
//   const actualMaxNumberOfMessages = Math.min(
//     convertedMaxNumberOfMessages,
//     systemMaxNumberOfMessages
//   );

//   const messageCount = await getMessageCountFromQueue(sourceQueueUrl);
//   console.log(`>>> Message count: ${messageCount}`);
//   const numberOfParallelRequests = Math.ceil(messageCount / maxNumberOfMessagesPerQuery);

//   console.log(`>>> Getting messages from source queue...`);
//   const messages: SQS.Message[] = [];
//   const res = await Promise.allSettled(
//     [...Array(numberOfParallelRequests).keys()].map(async () => {
//       const messagesOfRequest = await getMessagesFromQueue(sourceQueueUrl, {
//         maxNumberOfMessagesPerQuery,
//         maxNumberOfMessages: actualMaxNumberOfMessages,
//         poolUntilEmpty: true,
//       });
//       messages.push(...messagesOfRequest);
//     })
//   );
//   const failed = res.flatMap(r => (r.status === "rejected" ? String(r.reason) : []));
//   if (failed.length) {
//     const succeeded = res.filter(r => r.status === "fulfilled");
//     const uniqueMsgs = uniq(failed);
//     console.log(
//       `>>> Failed to get messages from SQS (total errors ${failed.length}, ` +
//         `unique errors ${uniqueMsgs.length}, succeeded ${succeeded.length}): ` +
//         `${uniqueMsgs.join("; ")}`
//     );
//   }

//   if (!messages || !messages.length) {
//     console.log(`>>> No messages to send`);
//     return { originalCount: messages.length, uniqueCount: -1 };
//   }

//   if (!messages || !messages.length) {
//     console.log(`>>> No messages to send`);
//     return { originalCount: messages.length, uniqueCount: -1 };
//   }

//   const uniqueMessages = uniqBy(messages, contentComparator);
//   console.log(`>>> Unique messages:`);
//   uniqueMessages.forEach(message => {
//     console.log("... ", message.Body);
//   });

//   console.log(`>>> Sending unique messages to destination queue...`);
//   await sqs
//     .sendMessageBatch({
//       QueueUrl: destinationQueueUrl,
//       Entries: uniqueMessages.map(m => ({
//         Id: m.MessageId ?? uuidv4(),
//         MessageBody: m.Body ?? "",
//         MessageAttributes: m.MessageAttributes && attributesToSend(m.MessageAttributes),
//       })),
//     })
//     .promise();

//   const result = {
//     originalCount: messages.length,
//     uniqueCount: uniqueMessages.length,
//   };
//   console.log(`>>> Success! ${JSON.stringify(result)})}`);
//   return result;
// }

// type ContentComparator = (m: SQS.Message) => string;
// const defaultComparator: ContentComparator = (m: SQS.Message) => m.Body ?? "";
