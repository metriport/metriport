import * as AWS from "aws-sdk";

const sqs = new AWS.SQS({ region: "us-east-1" });

export async function sendTestToQueue(url: string, sqsUrl: string) {
  for (let i = 0; i < 10; i++) {
    const params = {
      QueueUrl: sqsUrl,
      MessageBody: JSON.stringify({ url, index: i }),
    };

    await sqs.sendMessage(params).promise();
  }
}
