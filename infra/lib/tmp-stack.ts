import { CfnOutput, Duration, Stack, StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambda_node from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { EnvConfig } from "./env-config";
import * as s3 from "aws-cdk-lib/aws-s3";

interface TmpStackProps extends StackProps {
  config: EnvConfig;
  bucketName: string;
  version: string | undefined;
}

export class TmpStack extends Stack {
  constructor(scope: Construct, id: string, props: TmpStackProps) {
    super(scope, id, props);

    const vpcConstructId = "TestVpc";
    const vpc = new ec2.Vpc(this, vpcConstructId, {
      flowLogs: {
        apiVPCFlowLogs: { trafficType: ec2.FlowLogTrafficType.REJECT },
      },
    });

    //-------------------------------------------
    // S3 bucket for Medical Documents
    //-------------------------------------------

    const convertCda = this.setupConvertCda({
      vpc,
      bucketName: props.bucketName,
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

    const chromiumLayer = new lambda.LayerVersion(this, "chromium-layer", {
      compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
      code: lambda.Code.fromAsset("../api/lambdas/layers/chromium"),
      description: "Adds chromium to the lambdas",
    });

    const convertCdaLambda = new lambda_node.NodejsFunction(this, "ConvertCdaLambda", {
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: "../api/lambdas/convert-cda/index.js",
      environment: {
        ...(bucketName && {
          MEDICAL_DOCUMENTS_BUCKET_NAME: bucketName,
        }),
      },
      layers: [chromiumLayer],
      bundling: {
        minify: false,
        externalModules: ["aws-sdk", "@sparticuz/chromium"],
      },
      memorySize: 512,
      timeout: Duration.seconds(60),
      vpc,
    });

    const medicalDocumentsBucket = new s3.Bucket(this, "APIMedicalDocumentsBucket", {
      bucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });
    // Access grant for medical documents bucket
    medicalDocumentsBucket.grantReadWrite(convertCdaLambda);

    return convertCdaLambda;
  }
}
