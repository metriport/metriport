import { CfnOutput, Duration, Stack, StackProps } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as cloudfront_origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { ConnectWidgetConfig, EnvConfig } from "../config/env-config";
import { addErrorAlarmToLambdaFunc } from "./shared/lambda";

interface ConnectWidgetStackProps extends StackProps {
  config: Omit<EnvConfig, "connectWidget" | "connectWidgetUrl"> & {
    connectWidget: ConnectWidgetConfig;
  };
}

export class ConnectWidgetStack extends Stack {
  constructor(scope: Construct, id: string, props: ConnectWidgetStackProps) {
    super(scope, id, props);

    const idPrefix = "Connect";
    const widgetConfig = props.config.connectWidget;
    const domainName = widgetConfig.domain;
    const siteSubDomain = widgetConfig.subdomain;
    const zone = route53.HostedZone.fromLookup(this, `${idPrefix}Zone`, {
      domainName: widgetConfig.host,
    });
    const siteDomain = siteSubDomain + "." + domainName;
    const cloudfrontOAI = new cloudfront.OriginAccessIdentity(this, `${idPrefix}cloudfront-OAI`, {
      comment: `OriginAccessIdentity for ${idPrefix}`,
    });

    new CfnOutput(this, "Site", { value: "https://" + siteDomain });

    // Content bucket
    const siteBucket = new s3.Bucket(this, `${idPrefix}Bucket`, {
      bucketName: siteDomain,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Grant access to cloudfront
    siteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [siteBucket.arnForObjects("*")],
        principals: [
          new iam.CanonicalUserPrincipal(
            cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
      })
    );
    new CfnOutput(this, "Bucket", { value: siteBucket.bucketName });

    // TLS certificate
    const certificate = new acm.DnsValidatedCertificate(this, `${idPrefix}Certificate`, {
      domainName: siteDomain,
      hostedZone: zone,
      region: "us-east-1", // Cloudfront only checks this region for certificates.
    });
    // add error alarming to CDK-generated lambdas
    const certificateRequestorLambda = certificate.node.findChild(
      "CertificateRequestorFunction"
    ) as unknown as lambda.SingletonFunction;
    addErrorAlarmToLambdaFunc(
      this,
      certificateRequestorLambda,
      `${idPrefix}CertificateCertificateRequestorFunctionAlarm`
    );

    new CfnOutput(this, "Certificate", { value: certificate.certificateArn });

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, `${idPrefix}Distribution`, {
      certificate: certificate,
      defaultRootObject: "index.html",
      domainNames: [siteDomain],
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(30),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(30),
        },
      ],
      defaultBehavior: {
        origin: new cloudfront_origins.S3Origin(siteBucket, {
          originAccessIdentity: cloudfrontOAI,
        }),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });

    new CfnOutput(this, "DistributionId", {
      value: distribution.distributionId,
    });

    // Route53 alias record for the CloudFront distribution
    new route53.ARecord(this, `${idPrefix}AliasRecord`, {
      recordName: siteDomain,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      zone,
    });
  }
}
