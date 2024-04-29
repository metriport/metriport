import * as AWS from "aws-sdk";

const stepfunctions = new AWS.StepFunctions();

const stateMachineArn = process.env.STATE_MACHINE_ARN || "default-state-machine-arn";
//eslint-disable-next-line
export const handler = async (event: any) => {
  console.log("Event:", JSON.stringify(event), stateMachineArn);

  // Loop through each record in the event
  for (const record of event.Records) {
    const messageBody = JSON.parse(record.body);
    const input = JSON.stringify({
      url: messageBody.url,
      index: messageBody.index,
    });

    const params = {
      stateMachineArn,
      input: input,
      name: `Execution-${Date.now()}`,
    };

    try {
      const data = await stepfunctions.startExecution(params).promise();
      console.log("Success:", data);
    } catch (error) {
      console.error("Error starting state machine:", error);
      throw error;
    }
  }
};
