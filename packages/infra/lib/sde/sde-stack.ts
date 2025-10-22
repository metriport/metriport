import { Construct } from "constructs";
import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as s3 from "aws-cdk-lib/aws-s3";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { LambdaSettingsWithNameAndEntry } from "../shared/settings";
import { EnvType } from "../env-type";
import { EnvConfig } from "../../config/env-config";
import { LambdaLayers } from "../shared/lambda-layers";
import { createLambda } from "../shared/lambda";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { SDEAssets } from "./types";

const extractDocumentLambdaTimeout = Duration.seconds(300);

interface SDENestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
}

interface SDELambdaSettings {
  extractDocument: LambdaSettingsWithNameAndEntry;
}

const sdeLambda: SDELambdaSettings = {
  extractDocument: {
    name: "ExtractStructuredData",
    entry: "sde/extract-document",
    lambda: {
      memory: 1024,
      timeout: extractDocumentLambdaTimeout,
    },
  },
};

export class SDEStack extends NestedStack {
  private readonly structuredDataBucket: s3.Bucket;
  private readonly extractDocumentLambda: Lambda;

  constructor(scope: Construct, id: string, props: SDENestedStackProps) {
    super(scope, id, props);

    this.structuredDataBucket = new s3.Bucket(this, "StructuredDataBucket", {
      bucketName: props.config.structuredDataBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    const envVars: Record<string, string> = {
      STRUCTURED_DATA_BUCKET_NAME: this.structuredDataBucket.bucketName,
    };

    const commonConfig = {
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      quest: props.config.quest,
      systemRootOID: props.config.systemRootOID,
      termServerUrl: props.config.termServerUrl,
      envVars,
    };

    this.extractDocumentLambda = this.setupLambda("extractDocument", {
      ...commonConfig,
      structuredDataBucket: this.structuredDataBucket,
    });
  }

  getLambdas(): Lambda[] {
    return [this.extractDocumentLambda];
  }

  getAssets(): SDEAssets {
    return {
      structuredDataBucket: this.structuredDataBucket,
      extractDocumentLambda: this.extractDocumentLambda,
    };
  }

  private setupLambda<T extends keyof SDELambdaSettings>(
    lambdaName: T,
    props: {
      lambdaLayers: LambdaLayers;
      vpc: ec2.IVpc;
      envType: EnvType;
      envVars: Record<string, string>;
      sentryDsn: string | undefined;
      alarmAction: SnsAction | undefined;
      systemRootOID: string;
      structuredDataBucket: s3.Bucket;
    }
  ): Lambda {
    const { name, entry, lambda: lambdaSettings } = sdeLambda[lambdaName];

    const {
      lambdaLayers,
      vpc,
      envType,
      envVars,
      sentryDsn,
      alarmAction,
      systemRootOID,
      structuredDataBucket,
    } = props;

    const lambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        ...envVars,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        SYSTEM_ROOT_OID: systemRootOID,
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    structuredDataBucket.grantReadWrite(lambda);
    return lambda;
  }
}
