import BadRequestError from "../../../errors/bad-request";
import { getSignedUrl } from "../../../external/aws/s3";
import { getMessageCountFromQueue, peekMessagesFromQueue } from "../../../external/aws/sqs";
import { Config } from "../../../shared/config";

const dlqUrl = Config.getSidechainFHIRConverterDQLURL();

const maxNumberOfMessagesPerQuery = 10;
const linkDurationInSeconds = 10 * 60; // 10 minutes

export type ConversionDLQMessageType = {
  cxId: string;
  patientId: string;
  jobId?: string;
  s3FileName: string;
  s3BucketName: string;
  documentExtension: unknown;
  downloadLink: string;
};

/**
 * ADMIN LOGIC - not to be used by other endpoints/services.
 *
 * Read the first 10 messages from the sidechain DLQ without removing them,
 * and return a link to download the files they point to.
 */
export async function peekIntoSidechainDLQ(): Promise<{
  messageCount: number;
  first10Items: ConversionDLQMessageType[];
}> {
  if (!dlqUrl) throw new BadRequestError("Missing sidechain DLQ URL");

  const messageCount = await getMessageCountFromQueue(dlqUrl);
  console.log(`>>> Message count: ${messageCount}`);

  console.log(`>>> Getting messages from source queue...`);
  const messagesOfRequest = await peekMessagesFromQueue(dlqUrl, {
    maxNumberOfMessagesPerQuery,
    maxNumberOfMessages: maxNumberOfMessagesPerQuery,
  });

  if (!messagesOfRequest || !messagesOfRequest.length) {
    console.log(`>>> No messages found`);
    return { messageCount: 0, first10Items: [] };
  }

  const promises = messagesOfRequest.map(async m => {
    const cxId = m.MessageAttributes?.cxId?.StringValue ?? "na";
    const patientId = m.MessageAttributes?.patientId?.StringValue ?? "na";
    const jobId = m.MessageAttributes?.jobId?.StringValue ?? "na";
    const body = m.Body ? JSON.parse(m.Body) : undefined;
    const s3FileName = body.s3FileName ?? "na";
    const s3BucketName = body.s3BucketName ?? "na";
    const documentExtension = body.documentExtension ?? "na";
    const downloadLink = await getSignedUrl({
      bucketName: s3BucketName,
      fileName: s3FileName,
      durationSeconds: linkDurationInSeconds,
    });
    return {
      cxId,
      patientId,
      jobId,
      s3FileName,
      s3BucketName,
      documentExtension,
      downloadLink,
    };
  });
  const messages = await Promise.all(promises);

  const result = { messageCount: messages.length, first10Items: messages };
  console.log(`>>> Success! ${JSON.stringify(result)})}`);
  return result;
}
