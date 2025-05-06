import * as iam from "aws-cdk-lib/aws-iam";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";

export const defaultBedrockPolicyStatement = new iam.PolicyStatement({
  actions: ["bedrock:InvokeModel"],
  resources: [
    `arn:aws:bedrock:*:*:foundation-model/*`,
    `arn:aws:bedrock:*:*:inference-profile/*`,
    `arn:aws:bedrock:*:*:application-inference-profile/*`,
  ],
});

export function addBedrockPolicyToLambda(lambda: Lambda) {
  lambda.addToRolePolicy(defaultBedrockPolicyStatement);
}
