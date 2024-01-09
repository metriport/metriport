import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import * as apig from "aws-cdk-lib/aws-apigateway";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { createLambda } from "./shared/lambda";
import { setupLambdasLayers } from "./shared/lambda-layers";

interface IHECertStackProps extends StackProps {
  config: EnvConfig;
}

export class IHECertStack extends Stack {
  constructor(scope: Construct, id: string, props: IHECertStackProps) {
    super(scope, id, props);

    const vpcId = props.config.iheCertification?.vpcId;
    if (!vpcId) throw new Error("Missing VPC ID for IHE Certification stack");
    const vpc = ec2.Vpc.fromLookup(this, "APIVpc", { vpcId });

    const alarmSnsAction = setupSlackNotifSnsTopic(this, props.config);

    //-------------------------------------------
    // API Gateway
    //-------------------------------------------
    if (!props.config.iheCertification) {
      throw new Error("Must define IHE Cert properties!");
    }

    // Create the API Gateway
    const api = apig.RestApi.fromRestApiId(
      this,
      "IHECertAPIGateway",
      props.config.iheCertification.restApiId
    );

    const lambdaLayers = setupLambdasLayers(this, true);

    const iheLambda = createLambda({
      stack: this,
      name: "IHECertification",
      entry: "ihe-certification",
      layers: [lambdaLayers.shared],
      envType: props.config.environmentType,
      envVars: {
        ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
      },
      vpc,
      alarmSnsAction,
    });

    const proxy = new apig.ProxyResource(this, `IHE/Proxy`, {
      parent: api.root,
      anyMethod: false,
      defaultCorsPreflightOptions: { allowOrigins: ["*"] },
    });
    proxy.addMethod("ANY", new apig.LambdaIntegration(iheLambda), {
      requestParameters: {
        "method.request.path.proxy": true,
      },
    });

    //-------------------------------------------
    // Output
    //-------------------------------------------
    new CfnOutput(this, "IHECertAPIGatewayID", {
      description: "IHE Certification API Gateway ID",
      value: api.restApiId,
    });
    new CfnOutput(this, "IHECertAPIGatewayRootResourceID", {
      description: "IHE Certification API Gateway Root Resource ID",
      value: api.root.resourceId,
    });
  }
}

function setupSlackNotifSnsTopic(stack: Stack, config: EnvConfig): SnsAction | undefined {
  if (!config.slack) return undefined;
  const topicArn = config.iheCertification?.snsTopicArn;
  if (!topicArn) throw new Error("Missing SNS topic ARN for IHE stack");

  const slackNotifSnsTopic = sns.Topic.fromTopicArn(stack, "SlackSnsTopic", topicArn);
  const alarmAction = new SnsAction(slackNotifSnsTopic);
  return alarmAction;
}
