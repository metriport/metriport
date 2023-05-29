import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambda_node from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { EnvConfig } from "./env-config";

interface TmpStackProps extends StackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  version: string | undefined;
}

export class TmpStack extends Stack {
  constructor(scope: Construct, id: string, props: TmpStackProps) {
    super(scope, id, props);

    //-------------------------------------------
    // S3 bucket for Medical Documents
    //-------------------------------------------

    const convertCda = this.setupConvertCda({
      vpc: props.vpc,
      bucketName: props.config.medicalDocumentsBucketName,
    });

    //-------------------------------------------
    // Output
    //-------------------------------------------
    new CfnOutput(this, "CDAConvertFunctionName", {
      description: "CDA Convert Function Name",
      value: convertCda.functionName,
    });
  }

  private setupConvertCda(ownProps: { vpc: ec2.IVpc; bucketName: string | undefined }) {
    const { vpc, bucketName } = ownProps;

    const convertCdaLambda = new lambda_node.NodejsFunction(this, "ConvertCdaLambda", {
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: "../api/lambdas/convert-cda/index.js",
      environment: {
        ...(bucketName && {
          MEDICAL_DOCUMENTS_BUCKET_NAME: bucketName,
        }),
      },
      memorySize: 512,
      vpc,
    });

    return convertCdaLambda;
  }
}
