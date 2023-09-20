import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";

interface SearchStackProps extends StackProps {
  config: EnvConfig;
}

// function logSearchInfo(stack: Construct, secret: secret.Search, secretName: string) {
//   //-------------------------------------------
//   // Output
//   //-------------------------------------------
//   new CfnOutput(stack, `${secretName} ARN`, {
//     value: secret.secretArn,
//   });
// }

export class SearchsStack extends Stack {
  constructor(scope: Construct, id: string, props: SearchStackProps) {
    super(scope, id, props);
  }
}
